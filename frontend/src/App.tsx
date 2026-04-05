/**
 * App root — layout + initial robot info load.
 */

import { useEffect } from "react";
import { Scene3D } from "./components/Scene3D";
import { Sidebar } from "./components/Sidebar";
import { useStore } from "./store/useStore";

export default function App() {
  const loadRobotInfo = useStore((s) => s.loadRobotInfo);

  useEffect(() => {
    loadRobotInfo();
  }, [loadRobotInfo]);

  // Inline style on the root ensures full-viewport layout regardless of
  // whether the Tailwind build has run.  Tailwind classes are additive.
  return (
    <div
      className="relative w-full h-full"
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      <Scene3D />
      <Sidebar />
    </div>
  );
}
