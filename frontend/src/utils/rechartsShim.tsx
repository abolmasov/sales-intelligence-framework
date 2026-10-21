import type { ComponentType } from 'react';
import * as Recharts from 'recharts';

/** Recharts + React 19: upstream components use return types incompatible with strict JSX. */
const chart = (Component: unknown): ComponentType<any> => Component as ComponentType<any>;

export const LineChart = chart(Recharts.LineChart);
export const Line = chart(Recharts.Line);
export const AreaChart = chart(Recharts.AreaChart);
export const Area = chart(Recharts.Area);
export const BarChart = chart(Recharts.BarChart);
export const Bar = chart(Recharts.Bar);
export const PieChart = chart(Recharts.PieChart);
export const Pie = chart(Recharts.Pie);
export const Cell = chart(Recharts.Cell);
export const XAxis = chart(Recharts.XAxis);
export const YAxis = chart(Recharts.YAxis);
export const CartesianGrid = chart(Recharts.CartesianGrid);
export const Tooltip = chart(Recharts.Tooltip);
export const Legend = chart(Recharts.Legend);
export const ResponsiveContainer = chart(Recharts.ResponsiveContainer);
export const RadarChart = chart(Recharts.RadarChart);
export const PolarGrid = chart(Recharts.PolarGrid);
export const PolarAngleAxis = chart(Recharts.PolarAngleAxis);
export const PolarRadiusAxis = chart(Recharts.PolarRadiusAxis);
export const Radar = chart(Recharts.Radar);
