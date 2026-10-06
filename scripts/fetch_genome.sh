#!/usr/bin/env bash
# Downloads the C. elegans reference genome (RefSeq assembly GCF_000002985.6) from NCBI and joins it into one FASTA.
# Needs curl and a normal internet connection. About 100 MB when finished.
set -euo pipefail
OUT="${1:-data/genome}"
mkdir -p "$OUT"
# accession, label (chromosome lengths in bases from the NCBI RefSeq record)
ACCS="NC_003279.8:I NC_003280.10:II NC_003281.10:III NC_003282.8:IV NC_003283.11:V NC_003284.9:X NC_001328.1:MT"
: > "$OUT/c_elegans.fasta"
for pair in $ACCS; do
  acc="${pair%%:*}"; label="${pair##*:}"
  echo "fetching $acc (chromosome $label)"
  curl -fsS "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=${acc}&rettype=fasta&retmode=text" >> "$OUT/c_elegans.fasta"
  sleep 0.5   # NCBI asks for no more than 3 requests per second without an API key
done
echo "done: $OUT/c_elegans.fasta"
echo "check it with: node scripts/genome_stats.mjs $OUT/c_elegans.fasta"
