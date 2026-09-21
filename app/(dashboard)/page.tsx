import { getDashboardSummary } from '@/app/actions/dashboard'
import DashboardHome from '@/components/dashboard-home'

export default async function Page() {
  const summary = await getDashboardSummary()
  return <DashboardHome summary={summary} />
}
