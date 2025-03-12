import React, { useState, ChangeEvent, FormEvent } from 'react';
import { validateBoligsideUrl } from '../utils/validators';

interface UrlInputProps {
  onSubmit: (url: string) => void;
  isLoading?: boolean;
}

const UrlInput: React.FC<UrlInputProps> = ({ onSubmit, isLoading = false }) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    setError(null); // Clear error when the input changes
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    // Validate URL
    const validation = validateBoligsideUrl(url);
    if (!validation.valid) {
      setError(validation.error || 'Ugyldig URL');
      return;
    }
    
    // If validation passes, call the onSubmit handler
    onSubmit(url);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col space-y-2">
        <label htmlFor="url-input" className="text-gray-700 font-medium">
          Boligsiden URL
        </label>
        <div className="relative w-full">
          <input
            id="url-input"
            type="url"
            value={url}
            onChange={handleChange}
            placeholder="https://www.boligsiden.dk/adresse/..."
            className={`w-full p-2 border rounded-md ${
              error ? 'border-red-500' : 'border-gray-300'
            } focus:outline-none focus:ring-2 focus:ring-blue-500`}
            disabled={isLoading}
          />
        </div>
        {error && (
          <p className="text-red-500 text-sm mt-1">{error}</p>
        )}
        <p className="text-gray-500 text-sm">
          Indsæt en URL fra boligsiden.dk (f.eks. https://www.boligsiden.dk/adresse/kapelvej-27-3700-roenne...)
        </p>
      </div>
      <button
        type="submit"
        disabled={isLoading || !url}
        className={`mt-4 px-4 py-2 bg-blue-600 text-white rounded-md ${
          isLoading || !url ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
        }`}
      >
        {isLoading ? 'Analyserer...' : 'Analysér bolig'}
      </button>
    </form>
  );
};

export default UrlInput; 