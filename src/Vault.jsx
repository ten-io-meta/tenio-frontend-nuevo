import { fragments } from "./data/fragments";
import "./Vault.css";

export default function Vault() {
  return (
    <div className="vault-page">
      <header className="vault-header">
        <a className="back-link" href="/">← Back to TEN.IO</a>
        <h1>TEN.IO Fragment Vault</h1>
        <p>Audiovisual fragments preserved through IPFS.</p>
      </header>

      <section className="vault-grid">
        {fragments.map((item) => (
          <article className="vault-card" key={item.id}>
            <video
              className="vault-video"
              src={item.videoUrl}
              muted
              loop
              playsInline
              preload="metadata"
              onMouseEnter={(e) => e.currentTarget.play()}
              onMouseLeave={(e) => {
                e.currentTarget.pause();
                e.currentTarget.currentTime = 0;
              }}
              onClick={() => window.open(item.videoUrl, "_blank")}
            />

            <div className="vault-info">
              <span>{item.season} / {item.fragment}</span>
              <h2>{item.title}</h2>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}