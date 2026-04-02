"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4021";

interface AgentService {
  id: string;
  name: string;
  description: string;
  price: number;
  paymentType: "x402" | "mpp";
  category: string;
  reputationScore: number;
  totalCalls: number;
}

export default function ServiceRegistry() {
  const [services, setServices] = useState<AgentService[]>([]);

  useEffect(() => {
    async function fetchServices() {
      try {
        const res = await fetch(`${API_URL}/api/agents`);
        setServices(await res.json());
      } catch {
        // Server not running
      }
    }
    fetchServices();
  }, []);

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h2 className="text-xl font-semibold mb-4">Service Registry</h2>
      <p className="text-xs text-gray-500 mb-3">
        On-chain agent services (Soroban)
      </p>

      <div className="space-y-3">
        {services.map((service) => (
          <div
            key={service.id}
            className="bg-gray-800 rounded-lg p-4 border border-gray-700"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-white">{service.name}</h3>
              <span
                className={`px-2 py-0.5 rounded text-xs ${service.paymentType === "x402" ? "bg-indigo-900/50 text-indigo-300" : "bg-blue-900/50 text-blue-300"}`}
              >
                {service.paymentType.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-gray-400 mb-2">
              {service.description}
            </p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-green-400 font-mono">
                ${service.price.toFixed(4)} USDC/call
              </span>
              <span className="text-gray-500">
                Rep: {service.reputationScore} | Calls: {service.totalCalls}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
