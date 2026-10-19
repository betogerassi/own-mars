"use client";

import { useState } from "react";

export default function LikeButton({ plotId, initialLikes }: { plotId: string; initialLikes: number }) {
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(false);
  const like = async () => {
    const response = await fetch(`/api/plots/${encodeURIComponent(plotId)}/like`, { method: "POST" });
    if (!response.ok) return;
    const result = await response.json() as { likes: number; added: boolean };
    setLikes(result.likes); setLiked(result.added || liked);
  };
  return <button className="primary" disabled={liked} onClick={() => void like()}>{liked ? "LIKED" : "LIKE THIS PLACE"} · {likes}</button>;
}
