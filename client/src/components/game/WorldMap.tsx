import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { geoMercator, geoPath } from 'd3-geo';
import { zoom as d3zoom } from 'd3-zoom';
import { select } from 'd3-selection';
import * as topojson from 'topojson-client';
import { useGameStore } from '../../stores/game-store';
import { useUIStore } from '../../stores/ui-store';
import { INITIAL_COUNTRIES, getDefaultCountry } from '@faxhistoria/shared';
import type { Topology, GeometryCollection } from 'topojson-specification';

const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Map from Natural Earth country names to our game names (partial mapping for major countries)
const NAME_MAP: Record<string, string> = {
  'United States of America': 'United States',
  'S. Korea': 'South Korea',
  'N. Korea': 'North Korea',
  'Saudi Arabia': 'Saudi Arabia',
  'South Africa': 'South Africa',
  'Dem. Rep. Korea': 'North Korea',
  'Republic of Korea': 'South Korea',
  'Korea': 'South Korea',
};

function resolveCountryName(rawName: string): string {
  return NAME_MAP[rawName] ?? rawName;
}

function getCountryColor(
  countryName: string,
  countries: Record<string, { color: string }> | undefined,
): string {
  if (countries && countries[countryName]) {
    return countries[countryName].color;
  }
  const initial = INITIAL_COUNTRIES[countryName];
  if (initial) return initial.color;
  return getDefaultCountry(countryName).color;
}

export function WorldMap() {
  const svgRef = useRef<SVGSVGElement>(null);
  const gameState = useGameStore((s) => s.gameState);
  const selectCountry = useUIStore((s) => s.selectCountry);
  const selectedCountry = useUIStore((s) => s.selectedCountry);
  const [topoData, setTopoData] = useState<Topology | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // Fetch topojson data
  useEffect(() => {
    let cancelled = false;
    fetch(TOPO_URL)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setTopoData(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Render map
  useEffect(() => {
    if (!svgRef.current || !topoData) return;

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const projection = geoMercator()
      .scale(width / 6.5)
      .translate([width / 2, height / 1.5]);

    const pathGenerator = geoPath().projection(projection);

    const countries = topojson.feature(
      topoData,
      topoData.objects.countries as GeometryCollection,
    );

    const g = svg.append('g');

    // Background
    g.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', '#0F172A');

    // Country paths
    g.selectAll<SVGPathElement, GeoJSON.Feature>('path')
      .data((countries as GeoJSON.FeatureCollection).features)
      .join('path')
      .attr('d', (d) => pathGenerator(d) ?? '')
      .attr('fill', (d) => {
        const name = resolveCountryName(d.properties?.name ?? '');
        return getCountryColor(name, gameState?.countries);
      })
      .attr('stroke', '#334155')
      .attr('stroke-width', 0.5)
      .attr('cursor', 'pointer')
      .on('mouseover', function (_event, d) {
        const name = resolveCountryName(d.properties?.name ?? '');
        setHovered(name);
        select(this).attr('stroke', '#F8FAFC').attr('stroke-width', 1.5);
      })
      .on('mouseout', function () {
        setHovered(null);
        select(this).attr('stroke', '#334155').attr('stroke-width', 0.5);
      })
      .on('click', (_event, d) => {
        const name = resolveCountryName(d.properties?.name ?? '');
        selectCountry(name);
      });

    // Highlight selected country
    if (selectedCountry) {
      g.selectAll<SVGPathElement, GeoJSON.Feature>('path')
        .filter((d) => resolveCountryName(d.properties?.name ?? '') === selectedCountry)
        .attr('stroke', '#FBBF24')
        .attr('stroke-width', 2);
    }

    // Zoom
    const zoomBehavior = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });

    svg.call(zoomBehavior);
  }, [topoData, gameState?.countries, selectedCountry, selectCountry]);

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        className="h-full w-full"
        style={{ background: '#0F172A' }}
      />
      {hovered && (
        <div className="pointer-events-none absolute left-4 top-4 rounded-lg bg-surface/90 border border-border px-3 py-2 text-sm text-text-main">
          {hovered}
        </div>
      )}
    </div>
  );
}
