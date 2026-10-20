"""Turn a JSON-stat 2.0 dataset (what SCB's PxWebApi v2 returns) into rows."""

from __future__ import annotations

from typing import Any, Dict, List


def _category_codes(category: Dict[str, Any]) -> List[str]:
    index = category.get("index")
    if index is None:
        # A dimension with a single category may only carry labels.
        return list(category.get("label", {}).keys())
    if isinstance(index, list):
        return list(index)
    return [code for code, _ in sorted(index.items(), key=lambda kv: kv[1])]


def to_rows(dataset: Dict[str, Any], with_labels: bool = False) -> List[Dict[str, Any]]:
    """Flatten a JSON-stat 2.0 dataset into one dict per cell.

    Each row has one key per dimension holding the category code, plus
    ``value``. With ``with_labels=True`` each dimension also gets a
    ``<dimension>_label`` key with the category's text.

    Values come back as JSON-stat stores them, so a missing cell is None.
    """
    dim_ids: List[str] = list(dataset["id"])
    sizes: List[int] = list(dataset["size"])
    dims = dataset["dimension"]

    codes = [_category_codes(dims[d]["category"]) for d in dim_ids]
    labels = [dims[d]["category"].get("label", {}) for d in dim_ids]
    for d, size, cs in zip(dim_ids, sizes, codes):
        if len(cs) != size:
            raise ValueError(f"Dimension {d} has {len(cs)} categories but size says {size}")

    values = dataset.get("value", [])
    total = 1
    for s in sizes:
        total *= s
    if isinstance(values, dict):
        # Sparse form: {"flat index": value}
        dense: List[Any] = [None] * total
        for k, v in values.items():
            dense[int(k)] = v
        values = dense
    if len(values) != total:
        raise ValueError(f"Expected {total} values, got {len(values)}")

    # Row-major order: the last dimension changes fastest.
    strides = [1] * len(sizes)
    for i in range(len(sizes) - 2, -1, -1):
        strides[i] = strides[i + 1] * sizes[i + 1]

    rows: List[Dict[str, Any]] = []
    for flat, value in enumerate(values):
        row: Dict[str, Any] = {}
        for i, d in enumerate(dim_ids):
            pos = (flat // strides[i]) % sizes[i]
            code = codes[i][pos]
            row[d] = code
            if with_labels:
                row[f"{d}_label"] = labels[i].get(code, code)
        row["value"] = value
        rows.append(row)
    return rows
