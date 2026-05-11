import { fragments } from "./data/fragments";
import "./Vault.css";

function slugify(text = "") {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getSongName(title = "") {
  return title.split("—")[0].trim();
}

export default function FragmentPage() {
  const hash = window.location.hash || "";
  const route = hash.replace("#/fragment/", "");
  const idFromRoute = Number(route.split("-")[0]);

  const item = fragments.find((f) => Number(f.id) === idFromRoute);

  if (!item) {
    return (
      <div className="vault-page">
        <a className="back-link" href="/#/vault">← Back to Vault</a>
        <h1>Fragment not found</h1>
      </div>
    );
  }

  const songName = getSongName(item.title);
  const fragmentPath = `/#/fragment/${item.id}-${slugify(item.title)}`;
  const fragmentUrl = `https://tenio.eth.limo${fragmentPath}`;

  const description =
    item.description ||
    `${item.title} is an individual audiovisual fragment from the TEN.IO universe, archived through IPFS and connected to the broader Ethereum, ENS and music narrative of Season 01.`;

  const sameSong = fragments
    .filter((f) => f.fragment === item.fragment && f.id !== item.id)
    .slice(0, 6);

  const previous = fragments.find((f) => f.id === item.id - 1);
  const next = fragments.find((f) => f.id === item.id + 1);

  return (
    <div className="vault-page">
      <header className="vault-header">
        <a className="back-link" href="/#/vault">← Back to Vault</a>

        <p style={{ color: "#aaa", letterSpacing: "0.12em", fontSize: "13px" }}>
          TEN.IO / {item.season || "S01"} / {item.fragment}
        </p>

        <h1>{item.title}</h1>
        <p>{description}</p>
      </header>

      <section style={{ maxWidth: "980px", margin: "0 auto" }}>
        <video
          className="vault-video"
          src={item.videoUrl}
          controls
          autoPlay
          loop
          playsInline
          style={{
            width: "100%",
            borderRadius: "22px",
            background: "#000",
            maxHeight: "80vh",
            objectFit: "contain",
          }}
        />

        <div
          style={{
            marginTop: "28px",
            padding: "24px",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "20px",
            background: "rgba(255,255,255,0.035)",
            color: "#ddd",
            lineHeight: "1.7",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Fragment Metadata</h2>

          <p>
            <b>Title:</b> {item.title}
            <br />
            <b>Song / Arc:</b> {songName}
            <br />
            <b>Arc Title:</b> {item.arcTitle}
            <br />
            <b>Character:</b> {item.character}
            <br />
            <b>Location:</b> {item.location}
            <br />
            <b>Season:</b> {item.season || "S01"}
            <br />
            <b>Fragment:</b> {item.fragment}
            <br />
            <b>Archive:</b> TEN.IO Fragment Vault
          </p>

          <p>{description}</p>

          <p>
            <b>Keywords:</b>
            <br />
            {(item.keywords || []).join(" · ")}
          </p>

          <p>
            <b>Canonical fragment URL:</b>
            <br />
            <a href={fragmentPath} style={{ color: "white" }}>
              {fragmentUrl}
            </a>
          </p>

          <p>
            <b>IPFS video source:</b>
            <br />
            <a
              href={item.videoUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: "white" }}
            >
              Open video on IPFS gateway
            </a>
          </p>

         <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "24px" }}>
  
  <a className="vaultButton" href="/#/vault">
    Back to Vault
  </a>

  <a className="vaultButton" href="/#/music">
    Music Archive
  </a>

  <a
    className="vaultButton"
    href="https://open.spotify.com/playlist/2adgrdcBmuMbsYxiDHSRiy"
    target="_blank"
    rel="noreferrer"
  >
    Spotify Archive
  </a>

  {item.spotify && (
    <a
      className="vaultButton"
      href={item.spotify}
      target="_blank"
      rel="noreferrer"
    >
      Listen on Spotify
    </a>
  )}

  {item.tiktok && (
    <a
      className="vaultButton"
      href={item.tiktok}
      target="_blank"
      rel="noreferrer"
    >
      Watch on TikTok
    </a>
  )}

  {item.youtube && (
    <a
      className="vaultButton"
      href={item.youtube}
      target="_blank"
      rel="noreferrer"
    >
      Watch on YouTube
    </a>
  )}

  {item.contract && (
    <a
      className="vaultButton"
      href={item.contract}
      target="_blank"
      rel="noreferrer"
    >
      View Contract
    </a>
  )}

</div>
        </div>

        <div
          style={{
            marginTop: "24px",
            padding: "24px",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "20px",
            background: "rgba(255,255,255,0.025)",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Rabbit Hole</h2>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {previous && (
              <a className="vaultButton" href={`/#/fragment/${previous.id}-${slugify(previous.title)}`}>
                Previous Fragment
              </a>
            )}

            {next && (
              <a className="vaultButton" href={`/#/fragment/${next.id}-${slugify(next.title)}`}>
                Next Fragment
              </a>
            )}
          </div>

          {sameSong.length > 0 && (
            <>
              <h3>Related fragments from {item.arcTitle || songName}</h3>

              <div style={{ display: "grid", gap: "10px" }}>
                {sameSong.map((f) => (
                  <a
                    key={f.id}
                    href={`/#/fragment/${f.id}-${slugify(f.title)}`}
                    style={{ color: "white" }}
                  >
                    {f.season || "S01"} / {f.fragment} — {f.title}
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}