"""
Robot model loading.

Loads the Franka Panda via pinocchio's RobotWrapper directly from the URDF
bundled inside the `example-robot-data` cmeel package.  This avoids any
dependency on the `example_robot_data` Python module, which is not shipped by
the PyPI cmeel distribution.

URDF search order (first match wins):
  1. OUCH_PANDA_URDF env var — lets users point to a custom URDF
  2. The cmeel prefix bundled inside the active venv's site-packages
  3. /opt/openrobots (robotpkg installs)

To add a new robot:
  1. Add a new branch in `load_robot()`.
  2. Override `ee_frame_candidates` and `viz_joint_names` as needed.
"""

from __future__ import annotations
import os
import sys
import warnings
from dataclasses import dataclass, field
from pathlib import Path
import numpy as np
import pinocchio as pin
from ikpy.chain import Chain


@dataclass
class RobotModel:
    """Thin wrapper around a Pinocchio model+data pair + ikpy chain."""
    name: str
    model: pin.Model
    data: pin.Data
    ee_frame_id: int
    ee_frame_name: str
    neutral_config: np.ndarray
    # ikpy chain for IK (arm joints only, fingers excluded)
    ik_chain: Chain = field(default=None)
    # Mask: which of the ikpy chain's links are revolute/active
    ik_active_mask: list[bool] = field(default_factory=list)
    # Ordered list of frame names used for stick-figure visualisation
    viz_frame_names: list[str] = field(default_factory=list)
    # Paths for serving URDF + mesh assets to the frontend
    urdf_path: Path = field(default=None)
    mesh_base_dir: Path = field(default=None)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_robot(robot_name: str = "panda") -> RobotModel:
    """Load a robot model by name."""
    if robot_name == "panda":
        return _load_panda()
    raise ValueError(
        f"Unknown robot '{robot_name}'. Available: ['panda']"
    )


# ---------------------------------------------------------------------------
# Robot-specific loaders
# ---------------------------------------------------------------------------

def _load_panda() -> RobotModel:
    urdf_path = _find_panda_urdf()
    # URDF uses package://example-robot-data/... URLs.
    # pinocchio resolves these by looking for an "example-robot-data" directory
    # inside each package_dir entry.  The URDF lives at:
    #   <prefix>/share/example-robot-data/robots/panda_description/urdf/panda.urdf
    # so the correct package_dir is <prefix>/share/
    mesh_dir = str(urdf_path.parents[4])  # .../share/

    wrapper = pin.RobotWrapper.BuildFromURDF(
        str(urdf_path),
        [mesh_dir],
        None,  # fixed base
    )
    model: pin.Model = wrapper.model
    data: pin.Data = model.createData()

    ee_candidates = [
        "panda_grasptarget",
        "panda_ee",
        "panda_hand_tcp",
        "panda_hand",
        "panda_link8",
    ]
    ee_name = _find_frame(model, ee_candidates)
    ee_id = model.getFrameId(ee_name)

    q0 = pin.neutral(model)

    viz_candidates = [
        "panda_link0",
        "panda_link1",
        "panda_link2",
        "panda_link3",
        "panda_link4",
        "panda_link5",
        "panda_link6",
        "panda_link7",
        "panda_link8",
        "panda_hand",
        "panda_leftfinger",
        "panda_rightfinger",
    ]
    viz_frames = [n for n in viz_candidates if model.existFrame(n)]

    # Build ikpy chain for the arm (joints 1-7 only, stop at panda_hand_tcp).
    # Suppress ikpy's warnings about fixed links in the mask.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        ik_chain = Chain.from_urdf_file(
            str(urdf_path),
            base_elements=["panda_link0"],
            last_link_vector=[0, 0, 0],
        )

    # Build active mask: only the 7 revolute arm joints are active.
    # Chain links: [Base, joint1..7, joint8(fixed), hand_joint(fixed), tcp_joint(fixed)]
    active_mask = [
        False if (lnk.joint_type == "fixed" or lnk.name in ("Base link",))
        else True
        for lnk in ik_chain.links
    ]

    return RobotModel(
        name="panda",
        model=model,
        data=data,
        ee_frame_id=ee_id,
        ee_frame_name=ee_name,
        neutral_config=q0,
        ik_chain=ik_chain,
        ik_active_mask=active_mask,
        viz_frame_names=viz_frames,
        urdf_path=urdf_path,
        mesh_base_dir=Path(mesh_dir),
    )


# ---------------------------------------------------------------------------
# URDF discovery
# ---------------------------------------------------------------------------

_PANDA_URDF_RELATIVE = Path(
    "share/example-robot-data/robots/panda_description/urdf/panda.urdf"
)

def _find_panda_urdf() -> Path:
    """Locate the Panda URDF, trying several well-known locations."""

    # 1. Explicit override via environment variable
    env = os.environ.get("OUCH_PANDA_URDF")
    if env:
        p = Path(env)
        if p.is_file():
            return p
        raise FileNotFoundError(f"OUCH_PANDA_URDF={env} does not exist")

    # 2. cmeel prefix inside each entry on sys.path
    #    The pin/example-robot-data PyPI packages install URDFs under:
    #    <site-packages>/cmeel.prefix/share/example-robot-data/...
    for sp in sys.path:
        candidate = Path(sp) / "cmeel.prefix" / _PANDA_URDF_RELATIVE
        if candidate.is_file():
            return candidate

    # 3. robotpkg / openrobots prefix
    for prefix in ["/opt/openrobots", "/usr/local"]:
        candidate = Path(prefix) / _PANDA_URDF_RELATIVE
        if candidate.is_file():
            return candidate

    raise FileNotFoundError(
        "Could not find the Panda URDF.  Install 'example-robot-data' via pip "
        "(comes with the 'pin' package), or set OUCH_PANDA_URDF=/path/to/panda.urdf."
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _find_frame(model: pin.Model, candidates: list[str]) -> str:
    """Return the first candidate frame name that exists in the model."""
    for name in candidates:
        if model.existFrame(name):
            return name
    return model.frames[-1].name
