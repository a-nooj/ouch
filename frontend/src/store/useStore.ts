/**
 * Global app state managed with Zustand.
 *
 * Keeping all async calls here keeps components declarative:
 * they read state and call actions; the store handles fetching.
 */

import { create } from "zustand";
import {
  fetchFK,
  fetchOptimize,
  fetchReachability,
  fetchRobotInfo,
} from "../api/client";
import type {
  AppState,
  BasePose,
  FKResponse,
  OptimizeResponse,
  ReachabilityMap,
  RobotInfo,
  SE3,
  TargetPose,
} from "../types";
import { makeDefaultTargetPose } from "../utils/poses";

// ── Default values ────────────────────────────────────────────────────────────

const DEFAULT_BASE: BasePose = { x: 0, y: 0, yaw: 0 };

// ── Store type ────────────────────────────────────────────────────────────────

interface Store extends AppState {
  // ── Actions ──
  loadRobotInfo: () => Promise<void>;
  addTarget: (worldX: number, worldY: number, worldZ: number) => void;
  removeTarget: (id: string) => void;
  updateTargetPose: (id: string, pose: SE3) => void;
  setBasePose: (base: BasePose) => void;
  checkReachability: () => Promise<void>;
  optimize: (gridResolution?: number) => Promise<void>;
  refreshFK: () => Promise<void>;
  clearTargets: () => void;
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useStore = create<Store>((set, get) => ({
  // ── Initial state ──
  targets: [],
  basePose: DEFAULT_BASE,
  fkData: null,
  robotInfo: null,
  reachabilityMap: {},
  optimizationResult: null,
  isOptimizing: false,
  isCheckingReachability: false,
  backendError: null,

  // ── Load robot metadata once at startup ──
  loadRobotInfo: async () => {
    try {
      const info: RobotInfo = await fetchRobotInfo();
      set({ robotInfo: info, backendError: null });
      // Immediately compute FK at neutral config + default base
      await get().refreshFK();
    } catch (err) {
      set({ backendError: String(err) });
    }
  },

  // ── Add a target at a clicked world-space position (Z-up) ──
  addTarget: (worldX, worldY, worldZ) => {
    const id = crypto.randomUUID();
    const pose = makeDefaultTargetPose(worldX, worldY, worldZ);
    const newTarget: TargetPose = { id, pose };
    set((s) => ({ targets: [...s.targets, newTarget] }));
    // Asynchronously update reachability for all targets
    setTimeout(() => get().checkReachability(), 0);
  },

  removeTarget: (id) => {
    set((s) => ({
      targets: s.targets.filter((t) => t.id !== id),
      reachabilityMap: Object.fromEntries(
        Object.entries(s.reachabilityMap).filter(([k]) => k !== id),
      ),
    }));
    setTimeout(() => get().checkReachability(), 0);
  },

  updateTargetPose: (id, pose) => {
    set((s) => ({
      targets: s.targets.map((t) => (t.id === id ? { ...t, pose } : t)),
    }));
    setTimeout(() => get().checkReachability(), 0);
  },

  setBasePose: (base) => {
    set({ basePose: base });
    // Recompute FK and reachability when base changes
    setTimeout(async () => {
      await get().refreshFK();
      await get().checkReachability();
    }, 0);
  },

  // ── Reachability check ──
  checkReachability: async () => {
    const { targets, basePose } = get();
    if (targets.length === 0) {
      set({ reachabilityMap: {} });
      return;
    }
    set({ isCheckingReachability: true });
    try {
      const res = await fetchReachability(targets, basePose, 3);
      const map: ReachabilityMap = {};
      for (const r of res.results) {
        map[r.target_id] = r.reachable;
      }
      set({ reachabilityMap: map, backendError: null });
    } catch (err) {
      set({ backendError: String(err) });
    } finally {
      set({ isCheckingReachability: false });
    }
  },

  // ── Base-pose optimisation ──
  optimize: async (gridResolution = 10) => {
    const { targets } = get();
    if (targets.length === 0) return;
    set({ isOptimizing: true, optimizationResult: null });
    try {
      const result: OptimizeResponse = await fetchOptimize(targets, {
        grid_resolution: gridResolution,
        refine: true,
      });
      // Update base pose and reachability map from optimisation result
      const map: ReachabilityMap = {};
      for (const r of result.results) {
        map[r.target_id] = r.reachable;
      }
      set({
        optimizationResult: result,
        basePose: result.base,
        reachabilityMap: map,
        backendError: null,
      });
      // Refresh FK at the new base pose
      await get().refreshFK();
    } catch (err) {
      set({ backendError: String(err) });
    } finally {
      set({ isOptimizing: false });
    }
  },

  // ── Forward kinematics ──
  refreshFK: async () => {
    const { robotInfo, basePose } = get();
    if (!robotInfo) return;
    try {
      const fkData: FKResponse = await fetchFK(
        robotInfo.neutral_config,
        basePose,
      );
      set({ fkData, backendError: null });
    } catch (err) {
      set({ backendError: String(err) });
    }
  },

  clearTargets: () => {
    set({ targets: [], reachabilityMap: {}, optimizationResult: null });
  },
}));
