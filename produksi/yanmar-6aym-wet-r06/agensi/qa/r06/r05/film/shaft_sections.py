"""Estimate mesh shaft axes from repeated circular transverse sections, independently of drive pivots."""

from collections import Counter
import numpy as np
from scipy.spatial import ConvexHull, QhullError

SHAFT_MESHES = {
    "starter": "EXT-ELECTRIC-40",
    "timing": "INT-TIMING-01",
    "alternator": "EXT-ELECTRIC-21",
    "turbo": "EXT-EXHAUST-21",
    "freshwater": "EXT-COOLING-21",
    "seawater": "EXT-COOLING-36",
    "injection": "EXT-FUEL-21",
    "oil": "INT-OILPUMP-01",
}


def centerline(world):
    # All eight inspected shafts run along the engine X axis, per model datum.
    xyz = np.unique(np.round(world, 6), axis=0)
    candidates = []
    for x in np.unique(xyz[:, 0]):
        points = xyz[xyz[:, 0] == x, 1:]
        if len(points) < 12:
            continue
        try:
            rim = points[ConvexHull(points).vertices]
        except QhullError:
            continue
        if len(rim) < 8:
            continue
        # Fit the circle around a common X section after centering coordinates.
        origin = rim.mean(axis=0)
        q = rim - origin
        fit = np.linalg.lstsq(
            np.column_stack([2 * q, np.ones(len(q))]), (q * q).sum(axis=1), rcond=None
        )[0]
        center = origin + fit[:2]
        rad = np.linalg.norm(rim - center, axis=1)
        if rad.mean() < 0.002 or np.std(rad) / rad.mean() > 0.009:
            continue
        phi = np.sort(np.arctan2(rim[:, 1] - center[1], rim[:, 0] - center[0]))
        if np.diff(np.r_[phi, phi[0] + 2 * np.pi]).max() > 1.05:
            continue
        candidates.append((x, center))
    if not candidates:
        raise ValueError("No circular shaft sections in mesh")
    # Journal sections share a centre. Individual raised cam lobes may be eccentric.
    labels = [tuple(np.round(c * 2000).astype(int)) for _, c in candidates]
    best = Counter(labels).most_common(1)[0][0]
    consistent = [(x, c) for (x, c), key in zip(candidates, labels) if key == best]
    center = np.median([c for _, c in consistent], axis=0)
    return (
        np.r_[np.median([x for x, _ in consistent]), center],
        len(consistent),
        len(candidates),
    )
