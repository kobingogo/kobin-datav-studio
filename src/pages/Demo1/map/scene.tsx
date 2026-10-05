import { Suspense } from "react";
import Cloud from "./cloud";
import Base from "./base";
import Bottom from "./bottom";

import { cityGeoJSON, outlineGeoJSON } from "@/geo";

const mapData = cityGeoJSON,
  outlineData = outlineGeoJSON;

export default function Scene() {
  return (
    <Suspense fallback={null}>
      <Cloud />

      <Base data={mapData} outlineData={outlineData} />

      <Bottom />
    </Suspense>
  );
}
