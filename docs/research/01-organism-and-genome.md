# 01. The organism and its genome

**Confidence tags used in all research files.**
`[S]` seen in a source fetched while building this project (the source is named).
`[C]` computed from the data in this repository.
`[K]` stated from background knowledge. Check it against the primary paper before it goes on the site or into the README.

## 1.1 Taxonomy and husbandry

*Caenorhabditis elegans* is a free living soil nematode, phylum Nematoda, order Rhabditida. [K]
KEGG lineage string for the reference organism: Eukaryota; Metazoa; Ecdysozoa; Nematoda; Chromadorea; Rhabditida; Rhabditina; Rhabditomorpha; Rhabditoidea; Rhabditidae; Peloderinae; Caenorhabditis, NCBI taxonomy ID 6239. [S: KEGG organism page, genome.jp, T number T00019]

Sydney Brenner and colleagues adopted it as a model organism in the 1960s. [S: Mulcahy et al. 2018, Frontiers in Neural Circuits] Brenner's founding paper is "The genetics of *Caenorhabditis elegans*", Genetics 77:71 to 94, 1974. [K]

Practical facts that explain its success: [K unless marked]

- Adult hermaphrodites are about 1 mm long and transparent.
- It grows on agar plates fed *E. coli* (the usual strain is OP50, a uracil auxotroph that grows thinly).
- Generation time is about three days at 20 to 25 C. Adult lifespan is roughly two to three weeks.
- Most animals are self fertilising XX hermaphrodites. Males (X0) arise at around 0.1 percent from spontaneous X chromosome non disjunction, and mutations in *him* genes raise that rate.
- A hermaphrodite lays a few hundred self progeny. Crossing to males gives more.
- Stocks can be frozen in glycerol and revived, which made a shared global strain library possible (the Caenorhabditis Genetics Center).
- The standard wild type is the N2 Bristol strain. The Hawaiian isolate CB4856 is the usual divergent strain for mapping.

## 1.2 Cell counts and lineage

An adult hermaphrodite has 959 somatic nuclei, and an adult male has 1,031. [K] Of the 1,090 somatic cells generated during hermaphrodite development, 131 undergo programmed cell death, which is where 959 comes from. [K] The complete invariant cell lineage was worked out by John Sulston and colleagues: post embryonic lineages in Sulston and Horvitz 1977 (Developmental Biology 56:110) and the embryonic lineage in Sulston et al. 1983 (Developmental Biology 100:64). [K]

The nervous system of the adult hermaphrodite has 302 neurons. [S: White 1986 as summarised in several sources fetched, including Mulcahy et al. 2018 and the Harvard MCB news item] Of these, 20 are pharyngeal and 282 are non pharyngeal. [S: a SIUE student paper on the connectome network, which also notes the disputed male count; treat the 20 and 282 split as [K] and confirm against WormAtlas] About a quarter of the adult neurons are born after hatching. [S: Mulcahy et al. 2018]

## 1.3 Life cycle

Embryo, four larval stages (L1 to L4), adult. About three days at room temperature. [K]
Under crowding, starvation or heat, L1 larvae can enter an alternative L2d stage and then the dauer larva, a non feeding, stress resistant stage that can survive for weeks to months. [K]
Dauer entry is controlled by pheromone, food and temperature signalling that converges on insulin like and TGF beta pathways. [K]

Genes that came out of worm genetics and then mattered far beyond worms: [K]

- *daf-2* (insulin and IGF receptor). Kenyon et al. 1993, Nature 366:461. Mutations roughly double lifespan.
- *age-1* (PI3 kinase). Friedman and Johnson 1988, Genetics 118:75.
- *ced-3*, *ced-4*, *ced-9* (apoptosis). Work from the Horvitz lab, which led to the 2002 Nobel Prize.
- *lin-4* and *let-7* (microRNAs). Lee, Feinbaum and Ambros 1993; Wightman, Ha and Ruvkun 1993; Reinhart et al. 2000. These led to the 2024 Nobel Prize in Physiology or Medicine. [S: MIT news confirming Ambros and Ruvkun share the 2024 prize]
- RNA interference. Fire et al. 1998, Nature 391:806, which led to the 2006 Nobel Prize to Fire and Mello. [K]
- GFP as a marker in worm neurons. Chalfie et al. 1994, Science 263:802, part of the 2008 Chemistry Nobel Prize. [K]

A New York Times piece from October 2024 counted at least four Nobel prizes tied to the worm. [S: the Hobert lab hosted copy of the article]

## 1.4 The reference genome

| quantity | value | source |
| --- | --- | --- |
| Haploid nuclear genome size | 100,272,276 bp | [S] WormBase "Worm numbers" wiki |
| GC base pairs | 35,537,772 | [S] same page |
| AT base pairs | 64,734,504 | [S] same page |
| GC fraction | about 35.4 percent, so about 64.6 percent AT | [C] from the two lines above; also [S] a nematode genome table gives AT content 64.6 percent for *C. elegans* |
| Complete sequence including mitochondrion, as of the 2005 review | 100,291,840 bp | [S] Genome Research 15:1651 |
| Nucleotides in RefSeq GCF_000002985.6 | 100,286,401 | [S] KEGG |
| Number of chromosomes | six nuclear (I to V and X) plus one circular mitochondrial genome | [S] |
| Reference version | WBcel235, six gapless chromosomes with no ambiguous bases | [S] WormBase 2022 paper |
| Published | The C. elegans Sequencing Consortium, Science 282:2012 to 2018, 1998 | [S] KEGG record |

Chromosome lengths from the NCBI RefSeq record for GCF_000002985.6. [S: KEGG]

| chromosome | RefSeq | GenBank | length (bp) |
| --- | --- | --- | --- |
| I | NC_003279 | BX284601 | 15,072,434 |
| II | NC_003280 | BX284602 | 15,279,421 |
| III | NC_003281 | BX284603 | 13,783,801 |
| IV | NC_003282 | BX284604 | 17,493,829 |
| V | NC_003283 | BX284605 | 20,924,180 |
| X | NC_003284 | BX284606 | 17,718,942 |
| MT (circular) | NC_001328 | X54252 | 13,794 |

The six nuclear lengths sum to 100,272,607 bp. [C] This is within about 0.0003 percent of the WormBase figure, and the small difference is a version and rounding matter for Claude Code to chase if it wants an exact statement. The site displays 100.3 Mb.

### Gene counts

Counts depend on the annotation release and on what is counted as a gene. All of these are real and from different dates. Do not mix them in one sentence without naming the release. [S]

| release | protein coding genes | notes |
| --- | --- | --- |
| WS133 (2005) | 22,227 including 2,575 alternatively spliced forms | WormBook "Overview of gene structure" |
| WS140 (2005) | 19,735 genes, 2,685 alternative splice forms, 22,420 predicted proteins | Genome Research review; over 90 percent supported by experimental evidence; more than 1,300 non coding RNA genes |
| WS190 (2008) | 20,176 known protein coding, 1,454 pseudogenes, 6,298 RNA genes, 142,969 exons, 29,350 transcripts, 100,281,426 bp | GermOnline Ensembl mirror |
| WormBase 2022 | 19,985 coding of 49,187 total genes | WormBase 2022 paper |
| KEGG (RefSeq) | 19,984 protein genes, 24,827 RNA genes | KEGG organism page |

Gene structure, from the WormBook chapter: most genes cover about 3 kb of genome, the average gene has 6.4 coding exons, coding exons account for about 26 percent of the genome, median exon size is 123 bases, the most common intron size is 47 bases, and genes are denser on the autosomes than on X and denser in the central region of autosomes than on the arms. [S]

Other well established features worth knowing: [K]

- Holocentric chromosomes (kinetochores spread along the length rather than at a single centromere).
- Telomere repeat TTAGGC.
- Widespread trans splicing, with SL1 on roughly 70 percent of transcripts, and operons, with SL2 trans splicing downstream genes. Operons cover on the order of 15 percent of genes. Check the figure in Blumenthal's reviews before quoting a percentage.
- Cytosine methylation (5mC) is essentially absent. Whether N6 methyladenine is a real regulatory mark in worms is contested.
- Chromosome arms are repeat rich and recombine more, and centres are gene dense.

### Relatives and variation

WormBase and the Caenorhabditis community have sequenced many relatives. Genome size varies from about 48 Mb in *C. drosophilae* to about 160 Mb in *C. vivipara*, and protein coding gene number tracks genome size. [S: Cornell et al. abstract on caenorhabditis.org, hosted on WormBase] *C. briggsae* is a close relative with a roughly 108 Mb genome. [S: nematode genomes table, PMC3670170]

Natural variation is catalogued in CeNDR (the Caenorhabditis Natural Diversity Resource) and the Million Mutation Project made thousands of mutant alleles available. [K]

### Homology to human genes

A large share of worm genes have a recognisable human ortholog. The OrthoList resource (Shaye and Greenwald 2011, PLoS ONE) compiled a consensus list of worm genes with human orthologs from several prediction methods. [S: the search result listing for OrthoList; the exact percentage was not retrieved] Do not quote a percentage on the site until it is checked against that paper or a current Alliance of Genome Resources figure.

## 1.5 How the genome relates to the nervous system in this project

The genome is the instruction set. The connectome is the finished wiring. This project builds its model from the wiring and treats the genome as a data and visualisation layer.

Real links between the two layers that a future version could use: [K]

- Gene expression maps by neuron type. CeNGEN (Taylor et al. 2021, Cell 184:4329) profiled single cell expression across all 302 neurons in the L4 hermaphrodite. The OpenWorm toolbox lists gene expression datasets (Altun et al. 2009 and others). [S for the existence of the toolbox listing; K for CeNGEN details]
- Neurotransmitter identity maps. Pereira et al. 2015 (eLife) for acetylcholine, Serrano-Saiz et al. 2013 (Cell) for glutamate, Gendrel et al. 2016 (eLife) for GABA. These would replace the hand picked GABA list in `src/network.mjs`. [K]
- Receptor expression for monoamines and neuropeptides, used to build extrasynaptic networks. Bentley et al. 2016 (monoamines) and Ripoll-Sanchez et al. 2023 (neuropeptides) are listed in the OpenWorm toolbox. [S]

## 1.6 Open items for Claude Code

1. Fetch the real genome with `scripts/fetch_genome.sh` and run `scripts/genome_stats.mjs`. Compare the per chromosome lengths with the table above. The accession versions in the script (`NC_003279.8` and so on) were written from memory and must be confirmed against NCBI. If a version is wrong, `efetch` will return an error and the script will stop.
2. Decide whether to commit a compressed copy of the genome (about 30 MB gzipped) or keep it fetched on demand. The current `.gitignore` excludes it.
3. Replace the WS133, WS140 and WS190 era numbers anywhere they appear with the WormBase 2022 numbers, and say which release is meant.
4. Verify the 959, 131 and 1,090 figures, the 20 and 282 neuron split, and the operon and trans splicing percentages against primary sources.
