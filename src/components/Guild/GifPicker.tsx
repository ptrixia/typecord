import { useState, useEffect } from "react";
import { Search, TrendingUp, Star, X } from "lucide-react";

interface GifPickerProps {
  onSendGif: (url: string) => void;
}

const INITIAL_CATEGORIES = [
  { id: "favorites", label: "Favorites", isSpecial: true, query: "" },
  { id: "trending", label: "Trending GIFs", icon: TrendingUp, isSpecial: true, query: "trending" },
  { id: "hello", label: "hello", query: "hello" },
  { id: "lol", label: "lol", query: "lol" },
  { id: "love", label: "love", query: "love" },
  { id: "happy birthday", label: "happy birthday", query: "happy birthday" },
];

export default function GifPicker({ onSendGif }: GifPickerProps) {
  const [gifs, setGifs] = useState<string[]>([]);
  const [searchGifTerm, setSearchGifTerm] = useState("");
  const [activeView, setActiveView] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [categoryThumbnails, setCategoryThumbnails] = useState<Record<string, string>>({});

  useEffect(() => {
    const storedFavs = localStorage.getItem("@chat:favorite-gifs");
    if (storedFavs) {
      const parsedFavs = JSON.parse(storedFavs);
      setFavorites(parsedFavs);
      if (parsedFavs.length > 0) {
        setCategoryThumbnails((prev) => ({ ...prev, favorites: parsedFavs[0] }));
      }
    }
  }, []);

  useEffect(() => {
    const fetchCategoryBackgrounds = async () => {
      const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY;
      if (!apiKey) return;

      const newThumbnails: Record<string, string> = {};

      for (const cat of INITIAL_CATEGORIES) {
        if (cat.id === "favorites") continue;

        try {
          const endpoint = cat.id === "trending"
            ? `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=1&rating=g`
            : `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${cat.query}&limit=1&rating=g`;

          const res = await fetch(endpoint);
          const data = await res.json();
          if (data.data && data.data.length > 0) {

            newThumbnails[cat.id] = data.data[0].images.downsized_medium.url;
          }
        } catch (error) {
          console.error(`Erro ao carregar thumbnail para ${cat.id}:`, error);
        }
      }

      setCategoryThumbnails((prev) => ({ ...prev, ...newThumbnails }));
    };

    fetchCategoryBackgrounds();
  }, []);

  const toggleFavorite = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    let newFavs;
    if (favorites.includes(url)) {
      newFavs = favorites.filter((fav) => fav !== url);
    } else {
      newFavs = [...favorites, url];
    }
    
    setFavorites(newFavs);
    localStorage.setItem("@chat:favorite-gifs", JSON.stringify(newFavs));

    if (newFavs.length > 0) {
      setCategoryThumbnails((prev) => ({ ...prev, favorites: newFavs[0] }));
    }

    if (activeView === "favorites") {
      setGifs(newFavs);
    }
  };

  const fetchGifs = async (query = "", isTrending = false) => {
    const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY;
    if (!apiKey) return;

    setIsLoading(true);
    const endpoint = isTrending
      ? `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=20&rating=g`
      : `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${query}&limit=20&rating=g`;

    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      if (data.data) {
        // Mudamos de fixed_height_small para downsized_medium (tamanho padrão de chat grande)
        setGifs(data.data.map((g: any) => g.images.downsized_medium.url));
      }
    } catch (error) {
      console.error("Erro ao carregar GIFs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategoryClick = (categoryId: string) => {
    setActiveView(categoryId);
    setSearchGifTerm("");

    if (categoryId === "favorites") {
      setGifs(favorites);
    } else if (categoryId === "trending") {
      fetchGifs("", true);
    } else {
      fetchGifs(categoryId, false);
    }
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchGifTerm.trim() !== "") {
      setActiveView("search");
      fetchGifs(searchGifTerm, false);
    }
  };

  const clearSearch = () => {
    setSearchGifTerm("");
    setActiveView(null);
    setGifs([]);
  };

  return (
    <div className="flex h-[450px] w-[420px] flex-col overflow-hidden rounded-lg border border-zinc-800 bg-[#1e1f22] shadow-2xl">

      <div className="flex gap-2 p-3 pb-0 text-sm font-semibold">
        <div className="cursor-pointer rounded-md bg-[#383a40] px-3 py-1.5 text-zinc-100">
          GIFs
        </div>
        <div className="cursor-not-allowed px-3 py-1.5 text-zinc-400 opacity-70">Stickers</div>
        <div className="cursor-not-allowed px-3 py-1.5 text-zinc-400 opacity-70">Emoji</div>
      </div>

      <div className="p-3">
        <div className="flex items-center rounded bg-[#111214] px-3 py-1.5 border border-[#5865F2] focus-within:ring-1 focus-within:ring-[#5865F2]">
          <Search className="mr-2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search Klipy"
            className="w-full bg-transparent p-1 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
            value={searchGifTerm}
            onChange={(e) => setSearchGifTerm(e.target.value)}
            onKeyDown={handleSearch}
          />
          {(searchGifTerm || activeView) && (
            <X 
              className="ml-2 h-4 w-4 cursor-pointer text-zinc-400 hover:text-zinc-200" 
              onClick={clearSearch} 
            />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 pt-0 custom-scrollbar">
        

        {!activeView && (
          <div className="grid grid-cols-2 gap-3">
            {INITIAL_CATEGORIES.map((cat) => {
              const bgImage = categoryThumbnails[cat.id];

              return (
                <div
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.id)}
                  className="relative flex h-28 cursor-pointer items-center justify-center overflow-hidden rounded-md shadow transition-transform hover:scale-[1.02] bg-zinc-800"
                >
                  {bgImage ? (
                    <img
                      src={bgImage}
                      alt={cat.label}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-indigo-600/40"></div>
                  )}

                  <div className="absolute inset-0 bg-black/40"></div>
                  
                  <span className="relative z-10 flex items-center font-bold text-white drop-shadow-md text-center px-2">
                    {cat.icon && <cat.icon className="mr-1.5 h-4 w-4 shrink-0" />}
                    {cat.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {activeView && (
          <div className="grid grid-cols-2 gap-2.5">
            {isLoading ? (
              <div className="col-span-2 mt-12 text-center text-sm font-medium text-zinc-400">
                Buscando GIFs...
              </div>
            ) : gifs.length === 0 ? (
              <div className="col-span-2 mt-12 text-center text-sm font-medium text-zinc-400">
                {activeView === "favorites" ? "Você ainda não tem GIFs favoritos." : "Nenhum GIF encontrado."}
              </div>
            ) : (
              gifs.map((url, i) => (
                <div key={i} className="group relative">

                  <img
                    src={url}
                    alt="GIF Result"
                    className="h-36 w-full cursor-pointer rounded-md object-cover transition-transform group-hover:brightness-75"
                    onClick={() => onSendGif(url)}
                  />
                  
                  <div 
                    onClick={(e) => toggleFavorite(e, url)}
                    className="absolute right-2 top-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity hover:bg-black/90 group-hover:opacity-100 shadow"
                  >
                    <Star 
                      className={`h-4 w-4 ${favorites.includes(url) ? "fill-yellow-400 text-yellow-400" : "text-white"}`} 
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}