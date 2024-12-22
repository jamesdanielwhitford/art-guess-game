import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const ArtGuessingGame = () => {
  const [artwork, setArtwork] = useState(null);
  const [dotsWide, setDotsWide] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [gameState, setGameState] = useState('playing'); // playing, won, lost
  const [searchResults, setSearchResults] = useState([]);
  const canvasRef = useRef(null);
  const outputCanvasRef = useRef(null);

  // Get a deterministic random number for the day
  const getDailyArtworkId = () => {
    const today = format(new Date(), 'yyyyMMdd');
    const seed = Array.from(today).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    // Met API object IDs typically range from 1 to ~500000
    return (seed % 500000) + 1;
  };

  const fetchDailyArtwork = async () => {
    setIsLoading(true);
    try {
      // First fetch the specific artwork using our daily ID
      const objectId = getDailyArtworkId();
      const response = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectId}`);
      const data = await response.json();

      // Ensure we have all required fields and it's a public domain image
      if (data.primaryImage && data.title && data.artistDisplayName && data.isPublicDomain) {
        setArtwork({
          id: data.objectID,
          title: data.title,
          artist: data.artistDisplayName,
          year: data.objectDate,
          image: data.primaryImage,
          department: data.department
        });
      } else {
        // If artwork isn't suitable, recursively try the next ID
        // In production, you might want to maintain a list of known good IDs
        setArtwork(null);
        fetchDailyArtwork();
      }
    } catch (error) {
      console.error('Error fetching artwork:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const searchArtworks = async (query) => {
    if (!query) {
      setSearchResults([]);
      return;
    }

    try {
      // Search endpoint
      const response = await fetch(
        `https://collectionapi.metmuseum.org/public/collection/v1/search?q=${query}&hasImages=true`
      );
      const data = await response.json();
      
      // Limit to first 5 results for performance
      const limitedIds = data.objectIDs?.slice(0, 5) || [];
      
      // Fetch details for each artwork
      const detailPromises = limitedIds.map(id =>
        fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`)
          .then(res => res.json())
      );

      const details = await Promise.all(detailPromises);
      const formattedResults = details
        .filter(item => item.primaryImage && item.isPublicDomain)
        .map(item => ({
          id: item.objectID,
          title: item.title,
          artist: item.artistDisplayName,
          year: item.objectDate
        }));

      setSearchResults(formattedResults);
    } catch (error) {
      console.error('Error searching artworks:', error);
      setSearchResults([]);
    }
  };

  const processImage = (imageUrl) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const outputCanvas = outputCanvasRef.current;
      const outputCtx = outputCanvas.getContext('2d');

      // Set canvas dimensions
      const aspectRatio = img.height / img.width;
      canvas.width = dotsWide;
      canvas.height = Math.round(dotsWide * aspectRatio);
      
      // Set output canvas dimensions
      const scale = 20;
      outputCanvas.width = dotsWide * scale;
      outputCanvas.height = Math.round(dotsWide * aspectRatio) * scale;

      // Draw and process image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Clear output canvas
      outputCtx.fillStyle = 'white';
      outputCtx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);

      // Get pixel data and draw dots
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          outputCtx.beginPath();
          outputCtx.fillStyle = `rgb(${pixels[i]},${pixels[i + 1]},${pixels[i + 2]})`;
          outputCtx.arc(
            x * scale + scale/2,
            y * scale + scale/2,
            scale/2 * 0.8,
            0,
            Math.PI * 2
          );
          outputCtx.fill();
        }
      }
    };
    img.src = imageUrl;
  };

  const handleGuess = (selectedArtwork) => {
    if (selectedArtwork.id === artwork.id) {
      setGameState('won');
    } else {
      setDotsWide(prev => prev + 10);
      processImage(artwork.image);
    }
    setOpen(false);
    setSearchValue("");
    setSearchResults([]);
  };

  const handleSkip = () => {
    setDotsWide(prev => prev + 10);
    processImage(artwork.image);
  };

  // Initial load
  useEffect(() => {
    fetchDailyArtwork();
  }, []);

  // Process image when artwork changes or dots change
  useEffect(() => {
    if (artwork?.image) {
      processImage(artwork.image);
    }
  }, [artwork, dotsWide]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchArtworks(searchValue);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchValue]);

  if (isLoading) {
    return (
      <Card className="w-full max-w-4xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-96">
            <div className="text-lg">Loading today's artwork...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Daily Art Challenge</h2>
            <div className="text-sm text-gray-500">Resolution: {dotsWide}px</div>
          </div>

          <div className="space-y-4">
            <canvas ref={canvasRef} className="hidden" />
            <canvas ref={outputCanvasRef} className="w-full border rounded" />
          </div>

          {gameState === 'playing' && (
            <div className="space-y-4">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                  >
                    {searchValue || "Search for artwork or artist..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput 
                      placeholder="Search artwork or artist..." 
                      value={searchValue}
                      onValueChange={setSearchValue}
                    />
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandGroup>
                      {searchResults.map((art) => (
                        <CommandItem
                          key={art.id}
                          onSelect={() => handleGuess(art)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              art.id === artwork?.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {art.title} by {art.artist} ({art.year})
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>

              <Button onClick={handleSkip} variant="outline" className="w-full">
                Skip (+10px resolution)
              </Button>
            </div>
          )}

          {gameState === 'won' && (
            <div className="text-center space-y-4">
              <h3 className="text-xl font-bold text-green-600">
                Congratulations! You got it right!
              </h3>
              <p>
                {artwork.title} by {artwork.artist} ({artwork.year})
              </p>
              <p className="text-sm text-gray-500">
                From the {artwork.department} department
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ArtGuessingGame;