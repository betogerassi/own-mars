"use client";

import { useEffect, useRef } from "react";

type Format = "story" | "feed";
const sizes: Record<Format, [number, number]> = { story: [1080, 1920], feed: [1080, 1350] };

function fitText(context: CanvasRenderingContext2D, value: string, maxWidth: number) {
  let text = value;
  while (context.measureText(text).width > maxWidth && text.length > 1) text = text.slice(0, -2) + "…";
  return text;
}

function paint(canvas: HTMLCanvasElement, image: HTMLImageElement, format: Format, title: string, plotId: string, coordinates: string, publicUrl: string) {
  const [width, height] = sizes[format];
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#090909"; context.fillRect(0, 0, width, height);
  const scale = Math.max(width / image.width, height / image.height);
  const imageWidth = image.width * scale, imageHeight = image.height * scale;
  context.globalAlpha = .88; context.drawImage(image, (width - imageWidth) / 2, (height - imageHeight) / 2, imageWidth, imageHeight); context.globalAlpha = 1;
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(9,9,9,.05)"); gradient.addColorStop(1, "rgba(9,9,9,.94)"); context.fillStyle = gradient; context.fillRect(0, 0, width, height);
  context.fillStyle = "#f1ebe3"; context.font = "700 92px Arial"; context.fillText("I'M ON MARS.", 72, height - 350);
  context.fillStyle = "#e26c49"; context.font = "italic 52px Georgia"; context.fillText(fitText(context, title, width - 144), 72, height - 270);
  context.fillStyle = "#f1ebe3"; context.font = "28px Arial"; context.fillText("PLOT " + plotId + " · " + coordinates, 72, height - 190);
  context.font = "24px Arial"; context.fillText(fitText(context, publicUrl, width - 144), 72, height - 132);
  context.font = "700 27px Arial"; context.fillText("OWN MARS  ·  ownmars.space", 72, height - 70);
}

export default function SocialCardActions({ image, title, plotId, coordinates }: { image: string; title: string; plotId: string; coordinates: string }) {
  const story = useRef<HTMLCanvasElement>(null), feed = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const artwork = new Image();
    const publicUrl = window.location.origin + "/plot/" + encodeURIComponent(plotId);
    artwork.src = image;
    artwork.onload = () => { if (story.current) paint(story.current, artwork, "story", title, plotId, coordinates, publicUrl); if (feed.current) paint(feed.current, artwork, "feed", title, plotId, coordinates, publicUrl); };
  }, [coordinates, image, plotId, title]);
  const download = (format: Format) => { const canvas = format === "story" ? story.current : feed.current; if (!canvas) return; const link = document.createElement("a"); link.download = "own-mars-" + plotId + "-" + format + ".png"; link.href = canvas.toDataURL("image/png"); link.click(); };
  return <section className="social-cards"><canvas ref={story}/><canvas ref={feed}/><button className="primary" onClick={() => download("story")}>DOWNLOAD STORY CARD</button><button className="secondary" onClick={() => download("feed")}>DOWNLOAD FEED CARD</button></section>;
}
