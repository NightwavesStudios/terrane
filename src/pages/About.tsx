import Header from "../components/Header";
import { COUNTRY_COUNT, PLACES } from "../data/places";
import { navigate } from "../lib/router";

export default function About() {
  return (
    <div className="page">
      <Header tone="light" />

      <div className="about">
        <p className="eyebrow eyebrow--light">Terrane</p>
        <h1 className="about-title">
          The world is bigger
          <br />
          than your feed.
        </h1>
        <p className="about-lede">Go find the light.</p>

        <div className="about-cols">
          <div>
            <p>An interactive globe of mountains, national parks, cities and landmarks —
              every point a real place.</p>
            <p>
              Most travel sites are lists. This one is a map you can spin: real
              coordinates, a real type, a real high point. No invented copy, no filler, no
              padding written to fill a card.
            </p>
            <p>
              Spin the globe, click a light, and land somewhere. When you find something
              you want to keep, save it to a collection — they live in this browser, and
              nothing is sent anywhere.
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
          <h2>About the data</h2>
          <p>
            Every place here is a structured record — name, type, coordinates, high point,
            country — pulled from{" "}
            <a href="https://www.wikidata.org" target="_blank" rel="noreferrer">
              Wikidata
            </a>{" "}
            (CC0), with a hand-checked set across Georgia. Nothing is written to fill space.
            Proper field guides are the next thing to build, and they’ll arrive when
            they’re worth reading.
          </p>
          <p className="mono about-credits">
            Map © OpenStreetMap contributors · OpenFreeMap · Terrain Tiles (AWS Open Data)
            · Place data © Wikidata contributors
          </p>
        </div>

        <button className="btn btn-dark" onClick={() => navigate("/")}>
          Back to the globe →
        </button>
      </div>

      <footer className="foot">
        <span>Terrane — the world, worth the detour</span>
        <span className="mono">BUILT FOR PEOPLE WHO GO</span>
      </footer>
    </div>
  );
}
