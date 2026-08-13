// src/pages/countries/CountriesList.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import type { CountryListRead } from "@/types/country";

const CountriesList = () => {
  const { user } = useAuth();
  const [data, setData] = useState<CountryListRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<CountryListRead>("/countries")
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(err.response?.data?.detail || "Failed to load countries")
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center">Loading countries...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;

  const countries = data?.items ?? [];

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Countries</h1>

        {user?.is_admin && (
          <Link
            to="/add_country"
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg"
          >
            + Add Country
          </Link>
        )}
      </div>

      {countries.length === 0 ? (
        <h6 className="text-center text-gray-600 py-10">
          No available country now
        </h6>
      ) : (
        <div className="space-y-3">
          {countries.map((country) => (
            <Link
              key={country.id}
              to={`/countries/${country.id}`}
              className="block p-4 bg-white rounded-lg shadow hover:shadow-md border transition"
            >
              <span className="text-lg font-medium">{country.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default CountriesList;
