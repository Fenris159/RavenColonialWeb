import { extractSystemAtName, collectGalaxyStations } from "../lib/galaxy-stations-util";
import * as path from "path";
import * as os from "os";

const dump = path.join(os.homedir(), "Downloads", "galaxy_stations.json");

(async () => {
  const sys = (await extractSystemAtName(dump, "HIP 52675")) as {
    id64?: number;
    name?: string;
    bodies?: { stations?: { name: string }[]; bodies?: unknown[] }[];
  };
  console.log("id64", sys.id64, "name", sys.name, "top bodies", sys.bodies?.length);
  const names: string[] = [];
  const walk = (bodies: typeof sys.bodies) => {
    for (const x of bodies ?? []) {
      for (const s of x.stations ?? []) names.push(s.name);
      walk(x.bodies as typeof sys.bodies);
    }
  };
  walk(sys.bodies);
  console.log("all stations in tree", names.length);
  console.log("escobar names", names.filter(n => n.includes("Escobar")));
  const withEco = collectGalaxyStations(sys as Parameters<typeof collectGalaxyStations>[0]);
  console.log("with economies", withEco.length);
  console.log("escobar", withEco.find(s => s.name.includes("Escobar")));
})().catch(e => {
  console.error(e);
  process.exit(1);
});
