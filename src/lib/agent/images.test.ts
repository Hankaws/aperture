import assert from "node:assert/strict";
import { test } from "node:test";
import {
  anthropicContent,
  imagesNote,
  MAX_IMAGE_CHARS,
  MAX_IMAGES,
  MAX_IMAGES_CHARS,
  seesImages,
  toOpenAiMessages,
  validImages,
  type AgentImage,
} from "./images.ts";

const png = (name = "shot.png", data = "iVBORw0KGgo="): AgentImage => ({
  name,
  mediaType: "image/png",
  data,
});

test("a request's images are checked, and named for the person when they are not right", () => {
  assert.deepEqual(validImages(undefined), { images: [] });
  assert.deepEqual(validImages([png()]), { images: [png()] });
  // A name is trimmed and cut; a missing one is "image".
  assert.deepEqual(validImages([{ ...png(), name: `  ${"a".repeat(300)} ` }]), {
    images: [{ ...png(), name: "a".repeat(120) }],
  });
  assert.equal(
    (validImages([{ ...png(), name: "" }]) as { images: AgentImage[] }).images[0]!.name,
    "image",
  );
  assert.deepEqual(validImages("x"), { error: "The images could not be read." });
  assert.deepEqual(validImages(Array.from({ length: MAX_IMAGES + 1 }, () => png())), {
    error: `Attach at most ${MAX_IMAGES} images to a message.`,
  });
  assert.deepEqual(validImages([{ ...png(), mediaType: "image/svg+xml" }]), {
    error: "Attach PNG, JPEG, WebP or GIF images.",
  });
  assert.deepEqual(validImages([{ ...png(), data: "not base64!" }]), {
    error: "An image is too large. Attach a smaller screenshot.",
  });
  assert.deepEqual(validImages([{ ...png(), data: "A".repeat(MAX_IMAGE_CHARS + 4) }]), {
    error: "An image is too large. Attach a smaller screenshot.",
  });
  const big = "A".repeat(Math.ceil(MAX_IMAGES_CHARS / 3 / 4) * 4 + 4);
  assert.deepEqual(validImages([png("a", big), png("b", big), png("c", big)]), {
    error: "Those images are too large together. Attach fewer.",
  });
});

test("only DeepSeek's chat model is not sent images", () => {
  assert.deepEqual(
    ["grok", "openai", "anthropic", "gemini", "custom", "deepseek"].map(seesImages),
    [true, true, true, true, true, false],
  );
});

test("later turns are told of the images, not sent them", () => {
  assert.equal(imagesNote([]), "");
  assert.equal(imagesNote([{ name: "cart.png" }]), "[The user attached an image: cart.png]");
  assert.equal(
    imagesNote([{ name: "a.png" }, { name: "b.png" }]),
    "[The user attached 2 images: a.png, b.png]",
  );
});

test("OpenAI-compatible providers get text and image_url parts; the cache marker only where it is wanted", () => {
  const messages = [
    { role: "system", content: "Rules", cache: true },
    { role: "user", content: "Why is the button cut off?", cache: true, images: [png()] },
  ];
  assert.deepEqual(toOpenAiMessages(messages), [
    { role: "system", content: "Rules", cache: true },
    {
      role: "user",
      cache: true,
      content: [
        { type: "text", text: "Why is the button cut off?" },
        { type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgo=" } },
      ],
    },
  ]);
  // A local server would reject the marker.
  assert.deepEqual(toOpenAiMessages(messages, false)[0], { role: "system", content: "Rules" });
});

test("Anthropic gets the images first, then the text", () => {
  assert.equal(anthropicContent("Hi", undefined), "Hi");
  assert.deepEqual(anthropicContent("Why?", [png()]), [
    { type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo=" } },
    { type: "text", text: "Why?" },
  ]);
});
