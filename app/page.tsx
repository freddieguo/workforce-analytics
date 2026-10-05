export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold text-gray-900">
        Workforce Analytics
      </h1>

      <p className="mt-2 text-gray-500">
        Internal Labor Analytics Dashboard
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Total Demand</p>
          <p className="mt-2 text-3xl font-bold">2,279</p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Dispatched</p>
          <p className="mt-2 text-3xl font-bold">1,405</p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Workers</p>
          <p className="mt-2 text-3xl font-bold">2,813</p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">OT Rate</p>
          <p className="mt-2 text-3xl font-bold">5.78%</p>
        </div>
      </div>
    </main>
  );
}