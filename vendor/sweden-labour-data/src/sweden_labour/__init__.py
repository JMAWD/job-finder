"""Swedish labour market data, gathered the way the Labor Market Tracker does it.

    import sweden_labour as sl

    sl.list_datasets()                 # what's available
    ds = sl.get("tech_employment")     # one dataset, fetched live from SCB
    ds.rows                            # list of dicts
    ds.to_frame()                      # pandas DataFrame, if pandas is installed
    sl.collect(out_dir="data")         # everything, written to files with a manifest

    sl.scb.SCB().data("TAB4936", {...})        # any SCB table
    sl.jobtech.JobTech().count_ads(...)        # any Platsbanken ad count
"""

from ._version import __version__
from ._http import FetchError
from . import jobtech, jsonstat, scb
from .datasets import Dataset, collect, get, ids, list_datasets, load_file

__all__ = [
    "__version__",
    "Dataset",
    "FetchError",
    "collect",
    "get",
    "ids",
    "jobtech",
    "jsonstat",
    "list_datasets",
    "load_file",
    "scb",
]
