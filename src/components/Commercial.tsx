import React from 'react';

const Commercial: React.FC = () => {
  return (
    <div className="fixed bottom-3 right-3 z-50 hidden md:block">
      <a
        href="https://www.mikkelkajandersen.dk/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/95 dark:bg-gray-800/95 rounded-lg shadow-xl hover:shadow-2xl transition-all duration-200 border border-gray-200 dark:border-gray-700 hover:scale-105"
      >
        <span className="text-sm text-gray-600 dark:text-gray-300">
          Udviklet af
        </span>
        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
          Mikkel Kaj Andersen
        </span>
        <span className="text-sm text-gray-700 dark:text-gray-200">
          • AI & ML Solutions
        </span>
      </a>
    </div>
  );
};

export default Commercial; 