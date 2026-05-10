export default function MusicArchive() {
  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "white", padding: "40px" }}>
      <a href="/" style={{ color: "#aaa", textDecoration: "none" }}>← Back to TEN.IO</a>
      <h1>MUSIC ARCHIVE</h1>
      <p>TEN.IO — Spotify Archive</p>

      <iframe
        style={{ borderRadius: "12px" }}
        src="https://open.spotify.com/embed/playlist/2adgrdcBmuMbsYxiDHSRiy"
        width="100%"
        height="700"
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    </div>
  );
}