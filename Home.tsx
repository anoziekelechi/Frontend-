
@app.get("/")
def home():
    return {"message": "Welcome to ABC Shopping 





            // src/pages/Home.tsx — FINAL
import { useEffect, useState } from "react";
import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";

const Home = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWelcomeMessage = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await api.get("/");
        setMessage(res.data.message);
      } catch (err: any) {
        console.error(err);
        setError(
          err.response?.data?.detail || "Failed to load welcome message"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchWelcomeMessage();
  }, []);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600 animate-pulse">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center p-10 bg-white rounded-xl shadow-2xl max-w-md">
        <h1 className="text-4xl font-bold text-blue-800 mb-6">
          ABC Shopping Plaza
        </h1>

        {error ? (
          <p className="text-red-600 font-medium">{error}</p>
        ) : (
          <>
            <p className="text-2xl text-gray-800 font-medium mb-2">
              {user ? `Welcome ${user.surname}` : "Welcome Guest"}
            </p>
            <p className="text-xl text-gray-700">{message}</p>
          </>
        )}

        <p className="mt-8 text-sm text-gray-500">
          Powered by FastAPI + React
        </p>
      </div>
    </div>
  );
};

export default Home;
