import React, { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

export default function TopUpModal({ isOpen, onClose }) {
  const [crAmount, setCrAmount] = useState(1000);
  const conversionRate = 100;
  const usdPrice = (crAmount / conversionRate).toFixed(2);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#111113] border border-fi-accent/30 rounded-2xl p-6 w-full max-w-md relative shadow-[0_0_40px_rgba(255,215,0,0.15)] flex flex-col max-h-[90vh]">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-10">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div className="shrink-0">
          <h2 className="text-2xl font-black text-white mb-1 tracking-wide uppercase">Acquire Assets</h2>
          <p className="text-sm text-gray-400 mb-6">Top up your CR balance to dominate the market.</p>

          <div className="grid grid-cols-3 gap-3 mb-6">
            {[1000, 5000, 10000].map((amount) => (
              <button
                key={amount}
                onClick={() => setCrAmount(amount)}
                className={`py-3 rounded-lg font-bold text-sm transition-all duration-200 ${
                  crAmount === amount 
                    ? 'bg-fi-accent text-black shadow-[0_0_15px_rgba(255,215,0,0.4)] transform scale-105' 
                    : 'bg-black border border-white/10 text-gray-400 hover:border-white/30'
                }`}
              >
                {amount.toLocaleString()} CR
              </button>
            ))}
          </div>

          <div className="flex justify-between items-center mb-6 p-4 bg-black/50 rounded-lg border border-white/5">
            <span className="text-gray-400 font-medium">Total Cost:</span>
            <span className="text-2xl font-black text-white">${usdPrice}</span>
          </div>
        </div>

        {/* מנוע הסליקה - כאן אתה חייב להכניס את המפתח שלך */}
        <div className="mt-2 overflow-y-auto min-h-[150px] relative z-0">
          <PayPalScriptProvider options={{ 
            "client-id": "AWk4v2r_5daUDXeSphPHSRWKFhXHvKgi4N0sCUPJQjgtZtRGyJrK0HWvbUpgk8YqnW35oZT5TRJNEXBL", 
            currency: "USD",
            intent: "capture"
          }}>
            <PayPalButtons 
              style={{ layout: "vertical", color: "gold", shape: "rect", label: "pay" }}
              forceReRender={[usdPrice]}
              createOrder={(data, actions) => {
                return actions.order.create({
                  purchase_units: [{
                    amount: { 
                      value: usdPrice,
                      currency_code: "USD"
                    },
                    description: `${crAmount} CR for FashionInsider`
                  }]
                });
              }}
              onApprove={async (data, actions) => {
                const details = await actions.order.capture();
                alert(`Transaction approved by ${details.payer.name.given_name}. Adding ${crAmount} CR to your vault.`);
                onClose();
              }}
              onError={(err) => {
                console.error("PayPal Checkout Error:", err);
                alert("Payment engine failed to load. Check console.");
              }}
            />
          </PayPalScriptProvider>
        </div>

      </div>
    </div>
  );
}