#!/usr/bin/env bash
# Downloads the NCBI RefSeq gene annotation (GFF3) for the same assembly as scripts/fetch_genome.sh,
# GCF_000002985.6 (WBcel235). Same coordinates and chromosome accessions as the FASTA, so no renaming.
# About 20 MB compressed. The file is git ignored.
set -euo pipefail
OUT="${1:-data/genome}"
mkdir -p "$OUT"
URL="https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/002/985/GCF_000002985.6_WBcel235/GCF_000002985.6_WBcel235_genomic.gff.gz"
echo "fetching $URL"
curl -fsS -o "$OUT/annotation.gff.gz" "$URL"
echo "done: $OUT/annotation.gff.gz"
echo "summarise it with: node scripts/gene_windows.mjs $OUT/annotation.gff.gz"
