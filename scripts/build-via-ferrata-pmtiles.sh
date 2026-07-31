#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work_dir="${project_dir}/.tmp-via-ferrata"
output_file="${project_dir}/static/via-ferrata.pmtiles"

mkdir -p "${work_dir}"
trap 'rm -rf "${work_dir}"' EXIT

input_file="${work_dir}/austria-latest.osm.pbf"

echo "Downloading the Austria OSM PBF extract from Geofabrik..."
curl --fail --location --silent --show-error --retry 3 --connect-timeout 20 \
	-C - https://download.geofabrik.de/europe/austria-latest.osm.pbf \
	-o "${input_file}"

echo "Converting the OSM subset to PMTiles..."
docker run --rm --pull always \
	-v "${work_dir}:/data" \
	-v "${project_dir}/scripts:/scripts:ro" \
	-v "${project_dir}/static:/static" \
	ghcr.io/systemed/tilemaker:master \
		/data/austria-latest.osm.pbf \
		--output /static/via-ferrata.pmtiles \
		--config /scripts/via-ferrata-tilemaker.json \
		--process /scripts/via-ferrata-process.lua

echo "Wrote ${output_file}"
