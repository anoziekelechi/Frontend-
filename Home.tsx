
@app.get("/")
def home():
    return {"message": "Welcome to ABC Shopping Plaza 🛒"}



// src/pages/Home.tsx — FINAL, CLEAN
import { useEffect, useState } from "react";
import api from "@/api/client";  // your sacred Axios

export default function Home() {
  const [message, setMessage] = useState("Loading...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/")
      .then((res) => {
        setMessage(res.data.message);
      })
      .catch((err) => {
        console.error(err);
        setMessage("Failed to load welcome message");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center p-10 bg-white rounded-xl shadow-2xl max-w-md">
        <h1 className="text-4xl font-bold text-blue-800 mb-6">
          ABC Shopping Plaza
        </h1>
        {loading ? (
          <p className="text-gray-600 animate-pulse">Loading welcome...</p>
        ) : (
          <p className="text-2xl text-gray-800 font-medium">
            {message}
          </p>
        )}
        <p className="mt-8 text-sm text-gray-500">
          Powered by FastAPI + React • Built like Moniepoint
        </p>
      </div>
    </div>
  );
}
