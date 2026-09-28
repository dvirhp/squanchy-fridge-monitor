const labels: Record<string, string> = {
  temperature: 'Temperature issue',
  quality: 'Data-quality issue',
  clear: 'No detected issue',
  'no-data': 'No data in range',
};

export default function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{labels[status] ?? status}</span>;
}
