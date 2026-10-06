"""
Build data/connectome.json from the Cook et al. 2019 hermaphrodite adjacency
matrices, as packaged by the OpenWorm Connectome Toolbox (cect).

Source workbook: "SI 5 Connectome adjacency matrices, corrected July 2020.xlsx"
Cook SJ et al. (2019) Whole-animal connectomes of both Caenorhabditis elegans
sexes. Nature 571, 63-71. https://doi.org/10.1038/s41586-019-1352-7

Usage:
  pip download cect --no-deps -d dl && unzip dl/cect-*.whl -d dl/x
  python scripts/build_connectome.py dl/x/cect/data
"""
import csv, json, sys, collections, openpyxl

data_dir = sys.argv[1] if len(sys.argv) > 1 else "."
xlsx = f"{data_dir}/SI 5 Connectome adjacency matrices, corrected July 2020.xlsx"
info = {r["Cell name"].strip(): r for r in csv.DictReader(open(f"{data_dir}/all_cell_info.csv"))}
wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)

import re
def norm(label):
    # matrix files zero-pad (DA01); WormAtlas names do not (DA1)
    return re.sub(r"^([A-Z]+)0(\d)$", r"\1\2", str(label).strip())

def read_matrix(name):
    rows = list(wb[name].iter_rows(values_only=True))
    cols = {j: norm(c) for j, c in enumerate(rows[2]) if j >= 3 and c}
    edges = {}
    for r in rows[3:]:
        src = r[2]
        if not src:
            continue
        src = norm(src)
        for j, v in enumerate(r):
            if j in cols and isinstance(v, (int, float)) and v:
                edges[(src, cols[j])] = v
    return edges, {norm(r[2]) for r in rows[3:] if r[2]}, set(cols.values())

chem, chem_rows, chem_cols = read_matrix("hermaphrodite chemical")
gap, gap_rows, gap_cols = read_matrix("hermaphrodite gap jn symmetric")

# neurons are the labels that appear as rows (presynaptic) in the chemical sheet
# or in the gap junction sheet and that WormAtlas lists as neurons
neuron_names = [l.split(";")[0].strip() for l in open(f"{data_dir}/IndividualNeurons.csv") if ";" in l and not l.startswith("#")]
all_labels = chem_rows | chem_cols | gap_rows | gap_cols
neurons = sorted({n for n in neuron_names if n in all_labels})
print("neurons found:", len(neurons))

def cls(n):
    # coarse class from the WormAtlas "Type" string shipped in all_cell_info.csv.
    # "Touch" covers the touch receptor and touch related cells (ALN, PLN, SDQ, AQR, PQR),
    # and "O2, CO2" covers the gas sensing BAG and URX cells, so both count as sensory.
    # "Linker to pharynx" (RIP) is an interneuron. What is left in "other" is the pharyngeal
    # polymodal cells (MC, MI, NSM) and the canal cells (CAN).
    t = info.get(n, {}).get("Type", "")
    t = t.lower()
    if "sensory" in t or "amphid" in t or "mechano" in t or "cephalic" in t or "phasmid" in t: return "sensory"
    if "touch" in t or "o2" in t: return "sensory"
    if "motor" in t: return "motor"
    if "interneuron" in t or "linker" in t: return "inter"
    return "other"

ns = set(neurons)
out_edges = []
for (a, b), w in chem.items():
    if a in ns and b in ns:
        out_edges.append({"s": a, "t": b, "w": w, "k": "chem"})
seen = set()
for (a, b), w in gap.items():
    if a in ns and b in ns and (b, a) not in seen:
        seen.add((a, b))
        out_edges.append({"s": a, "t": b, "w": w, "k": "gap"})

out = {
    "source": "Cook et al. 2019, hermaphrodite, via OpenWorm Connectome Toolbox",
    "neurons": [{"id": n, "class": cls(n), "type": info.get(n, {}).get("Type", ""), "lineage": info.get(n, {}).get("Lineage", "")} for n in neurons],
    "edges": out_edges,
}
json.dump(out, open("data/connectome.json", "w"), separators=(",", ":"))
c = collections.Counter(n["class"] for n in out["neurons"])
print(dict(c), "edges:", len(out_edges), collections.Counter(e["k"] for e in out_edges))
