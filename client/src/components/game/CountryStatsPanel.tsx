import { useGameStore } from '../../stores/game-store';
import { useUIStore } from '../../stores/ui-store';
import { INITIAL_COUNTRIES, getDefaultCountry } from '@faxhistoria/shared';

export function CountryStatsPanel() {
  const selectedCountry = useUIStore((s) => s.selectedCountry);
  const selectCountry = useUIStore((s) => s.selectCountry);
  const gameState = useGameStore((s) => s.gameState);

  if (!selectedCountry) return null;

  // Use game state data if available, fall back to initial data
  const liveCountry = gameState?.countries[selectedCountry];
  const initialCountry = INITIAL_COUNTRIES[selectedCountry];
  const fallback = getDefaultCountry(selectedCountry);

  const country = liveCountry ?? (initialCountry ? { ...initialCountry, relations: [] } : { ...fallback, relations: [] });

  return (
    <div className="max-h-[66vh] overflow-y-auto pr-1">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: country.color }}
          />
          <h3 className="font-semibold text-text-main">{country.displayName}</h3>
        </div>
        <button
          onClick={() => selectCountry(null)}
          className="cursor-pointer text-xs text-text-secondary hover:text-text-main"
        >
          Close
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Stat label="GDP" value={`$${country.gdp}B`} />
        <Stat label="Population" value={`${country.population}M`} />
        <Stat label="Stability" value={`${country.stability}%`} />
        <Stat label="Government" value={country.government} />
        <Stat label="Military" value={`${country.military.strength}`} />
        <Stat label="Defense Budget" value={`$${country.military.defenseBudget}B`} />
        <Stat label="Nuclear" value={country.military.nuclearCapable ? 'Yes' : 'No'} />
        <Stat label="Leader" value={country.leader} />
      </div>

      {country.relations.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <h4 className="text-xs font-medium text-text-secondary mb-2">
            Diplomatic Relations
          </h4>
          <div className="flex flex-col gap-1">
            {country.relations.map((rel) => (
              <div
                key={rel.country}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-text-main">{rel.country}</span>
                <span className={relationColor(rel.status)}>{rel.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-text-secondary">{label}</div>
      <div className="font-medium text-text-main">{value}</div>
    </div>
  );
}

function relationColor(status: string): string {
  switch (status) {
    case 'ALLIED':
      return 'text-green-400';
    case 'FRIENDLY':
      return 'text-blue-400';
    case 'NEUTRAL':
      return 'text-gray-400';
    case 'HOSTILE':
      return 'text-orange-400';
    case 'AT_WAR':
      return 'text-red-400';
    default:
      return 'text-text-secondary';
  }
}
