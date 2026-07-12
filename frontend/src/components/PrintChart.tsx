import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

interface PrintChartProps {
  type: 'bar' | 'line' | 'pie';
  labels: string[];
  datasets: { label: string; data: number[]; backgroundColor?: string | string[]; borderColor?: string | string[] }[];
  title?: string;
}

export default function PrintChart({ type, labels, datasets, title }: PrintChartProps) {
  const data = { labels, datasets };
  const options = {
    responsive: true,
    plugins: { title: title ? { display: true, text: title } : undefined, legend: { display: type !== 'bar' } },
    scales: type !== 'pie' ? { y: { beginAtZero: true } } : undefined,
  };

  if (type === 'bar') return <Bar data={data} options={options} />;
  if (type === 'line') return <Line data={data} options={options} />;
  return <Pie data={data} options={options} />;
}
