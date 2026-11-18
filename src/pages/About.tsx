import Header from "../components/Header";
import { COUNTRY_COUNT, PLACES } from "../data/places";
import { navigate } from "../lib/router";

export default function About() {
  return (
    <div className="page">
      <Header tone="light" />

      <div className="about">
        <p className="eyebrow eyebrow--light">About</p>
        <h1 className="about-title">
          A globe of places
          <br />
          worth going outside for.
        </h1>
        <p className="about-lede">
          Peaks, national parks, landmarks and hidden gems — {PLACES.length.toLocaleString()}{" "}
          of them, across {COUNTRY_COUNT} countries.
        </p>

        <div className="about-cols">
          <div>
            <p>
              Terrane is one map instead of a list. Spin the globe, click a point, and you
              get where it is, how high it stands, and what is around it.
            </p>
            <p>
              Every place is a record — name, type, coordinates, elevation, country — from
              Wikidata. The Georgia entries are written by hand. Nothing is invented to
              fill a card.
            </p>
            <p>
              The globe is MapLibre with OpenStreetMap data, shaded from Mapterhorn
              elevation tiles. Footpaths are drawn from the basemap as dashed lines. Saved
              places live in this browser only: no account, no server, nothing sent
              anywhere.
            </p>
          </div>
          <div className="about-facts">
            <div>
              <span className="mono k">Places</span>
              <span className="v">{PLACES.length.toLocaleString()}</span>
            </div>
            <div>
              <span className="mono k">Countries</span>
              <span className="v">{COUNTRY_COUNT}</span>
            </div>
            <div>
              <span className="mono k">Peaks</span>
              <span className="v">
                {PLACES.filter((p) => p.type === "peak").length.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="mono k">Parks</span>
              <span className="v">
                {PLACES.filter((p) => p.type === "park").length.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="about-note">
          <h2>What it does not have</h2>
          <p>
            No route database, so no named trails, difficulty grading or elevation
            profiles — footpaths come from the basemap and stay unlabelled. No field
            guides either. Both need data this app does not carry yet, and shipping
            guesses instead would be worse than leaving them out.
          </p>
          <p className="mono about-credits">
            Map © OpenStreetMap contributors · OpenFreeMap · Terrain: Mapterhorn · Place
            data © Wikidata contributors (CC0)
          </p>
        </div>

        <button className="btn btn-dark" onClick={() => navigate("/")}>
          Back to the globe →
        </button>
      </div>

      <footer className="foot">
        <span>Terrane — the world, worth the detour</span>
        <span className="mono">MAPS FOR PEOPLE WHO GO</span>
      </footer>
    </div>
  );
}
