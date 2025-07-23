import React, { useState } from 'react';
import { MapPin, Upload, Download } from 'lucide-react'; // This import is correct, no fix needed here.
import Papa from 'papaparse'; // Ensure papaparse is installed: npm install papaparse @types/papaparse
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card';

const GeoConverter = () => {
  const [location, setLocation] = useState({
    city: '',
    state: '',
    neighborhood: ''
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [batchResults, setBatchResults] = useState(null);
  const [processingProgress, setProcessingProgress] = useState(0);

  const getCoordinates = async (searchQuery) => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch coordinates');
    }

    const data = await response.json();
    
    if (data.length === 0) {
      throw new Error('Location not found');
    }
    
    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
      displayName: data[0].display_name
    };
  };

  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const searchQuery = `${location.neighborhood ? location.neighborhood + ', ' : ''}${location.city}, ${location.state}`;
      const coordinates = await getCoordinates(searchQuery);
      setResult(coordinates);
    } catch (err) {
      setError(err.message || 'An error occurred while fetching coordinates.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setBatchResults(null);
    setProcessingProgress(0);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const processedResults = [];
          let processed = 0;

          for (const row of results.data) {
            try {
              const searchQuery = `${row.neighborhood ? row.neighborhood + ', ' : ''}${row.city}, ${row.state}`;
              const coordinates = await getCoordinates(searchQuery);
              
              processedResults.push({
                ...row,
                latitude: coordinates.lat,
                longitude: coordinates.lon,
                found_location: coordinates.displayName,
                status: 'success'
              });
            } catch (err) {
              processedResults.push({
                ...row,
                status: 'error',
                error: err.message
              });
            }

            processed++;
            setProcessingProgress((processed / results.data.length) * 100);
            
            // Add delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          setBatchResults(processedResults);
        } catch (err) {
          setError('Error processing file: ' + err.message);
        } finally {
          setLoading(false);
          setProcessingProgress(0);
        }
      },
      error: (err) => {
        setError('Error parsing CSV: ' + err.message);
        setLoading(false);
      }
    });
  };

  const downloadResults = () => {
    if (!batchResults) return;

    const csv = Papa.unparse(batchResults);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'geocoding_results.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-6 w-6" />
          Location to Coordinates Converter
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {/* Single Location Form */}
          <div>
            <h3 className="text-lg font-medium mb-4">Convert Single Location</h3>
            <form onSubmit={handleSingleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">City</label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded-md"
                    value={location.city}
                    onChange={(e) => setLocation(prev => ({ ...prev, city: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">State</label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded-md"
                    value={location.state}
                    onChange={(e) => setLocation(prev => ({ ...prev, state: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Neighborhood (optional)</label>
                  <input
                    type="text"
                    className="w-full p-2 border rounded-md"
                    value={location.neighborhood}
                    onChange={(e) => setLocation(prev => ({ ...prev, neighborhood: e.target.value }))}
                  />
                </div>
              </div>
              
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-400"
                disabled={loading}
              >
                {loading ? 'Converting...' : 'Convert to Coordinates'}
              </button>
            </form>

            {result && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                <h3 className="font-medium text-green-800 mb-2">Results:</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Latitude:</span> {result.lat}</p>
                  <p><span className="font-medium">Longitude:</span> {result.lon}</p>
                  <p><span className="font-medium">Found Location:</span> {result.displayName}</p>
                </div>
              </div>
            )}
          </div>

          {/* Batch Processing Section */}
          <div className="border-t pt-8">
            <h3 className="text-lg font-medium mb-4">Batch Convert from CSV</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-2 text-gray-500" />
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">CSV with columns: city, state, neighborhood (optional)</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".csv"
                    onChange={handleFileUpload}
                    disabled={loading}
                  />
                </label>
              </div>

              {loading && processingProgress > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{ width: `${processingProgress}%` }}
                  ></div>
                </div>
              )}

              {batchResults && (
                <div className="space-y-4">
                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-64 overflow-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Coordinates</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {batchResults.map((result, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {`${result.city}, ${result.state}${result.neighborhood ? `, ${result.neighborhood}` : ''}`}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {result.status === 'success' 
                                  ? `${result.latitude}, ${result.longitude}`
                                  : '-'
                                }
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                                  result.status === 'success'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {result.status === 'success' ? 'Success' : 'Error'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <button
                    onClick={downloadResults}
                    className="flex items-center justify-center gap-2 w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700"
                  >
                    <Download className="w-4 h-4" />
                    Download Results CSV
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GeoConverter;