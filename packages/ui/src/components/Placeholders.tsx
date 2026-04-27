export function CodeEditorMockup() {
  return (
    <div className="w-full font-mono text-sm text-left">
      <div className="bg-gray-900 text-gray-100 p-4 rounded-md">
        <div className="text-green-400">fn execute_trade() {`{`}</div>
        <div className="ml-4 text-blue-400">let signal = await verifyWebhook();</div>
        <div className="ml-4 text-blue-400">return tradeWorker.fetch(signal);</div>
        <div className="text-green-400">{`}`}</div>
        <div className="mt-2 text-yellow-400">Compiled ✓ Bundle: 12kb</div>
      </div>
    </div>
  );
}

export function ShieldMockup() {
  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative w-20 h-24 bg-blue-50 rounded-lg border-2 border-blue-200 flex items-center justify-center">
        <div className="text-blue-500 text-4xl">🛡️</div>
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
      </div>
      <div className="mt-2 text-sm font-medium text-green-600">System Secure</div>
    </div>
  );
}

export function ServerMockup() {
  return (
    <div className="w-full">
      <div className="bg-gray-50 p-3 rounded-md border">
        <div className="text-sm font-medium mb-2">Edge Fleet: 120 NODES</div>
        <div className="space-y-1">
          {['RACK_01', 'RACK_02', 'RACK_03'].map(node => (
            <div key={node} className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>{node}</span>
              <span className="text-gray-400 ml-auto">Active</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TerminalMockup() {
  return (
    <div className="w-full font-mono text-xs text-left">
      <div className="bg-gray-900 text-gray-100 p-3 rounded-md">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-gray-400 ml-2">LIVE</span>
        </div>
        <div className="space-y-1">
          <div><span className="text-gray-500">10:42:01</span> <span className="text-green-400">200</span> GET /api/v1/metrics</div>
          <div><span className="text-gray-500">10:42:02</span> <span className="text-green-400">200</span> POST /auth/session</div>
          <div><span className="text-gray-500">10:42:04</span> <span className="text-green-400">200</span> GET /api/v1/user</div>
        </div>
      </div>
    </div>
  );
}

export function StorageMockup() {
  return (
    <div className="w-full">
      <div className="bg-gray-50 p-3 rounded-md border">
        <div className="text-sm font-medium mb-3">Command Center</div>
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Storage Pool 01</span>
              <span>84%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{width: '84%'}}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Active Positions</span>
              <span>12</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full" style={{width: '60%'}}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
