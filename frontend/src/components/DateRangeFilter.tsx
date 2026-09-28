import { useSearchParams } from 'react-router-dom';

export default function DateRangeFilter() {
  const [params, setParams] = useSearchParams();
  const change = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };
  return (
    <>
      <label>
        From
        <input
          type="date"
          value={params.get('from') ?? ''}
          onChange={(e) => change('from', e.target.value)}
        />
      </label>
      <label>
        To
        <input
          type="date"
          value={params.get('to') ?? ''}
          onChange={(e) => change('to', e.target.value)}
        />
      </label>
      <button
        type="button"
        className="secondary"
        onClick={() => {
          const next = new URLSearchParams(params);
          next.delete('from');
          next.delete('to');
          setParams(next);
        }}
      >
        All dates
      </button>
    </>
  );
}
