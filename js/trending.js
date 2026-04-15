/**
 * ============================================
 *  NETFLIX PREMIUM – Trending Movies (TMDB)
 *  Tự động cập nhật 5 phim hot nhất mỗi ngày
 * ============================================
 */

const Trending = {
  TMDB_BASE: 'https://api.themoviedb.org/3',
  TMDB_IMG: 'https://image.tmdb.org/t/p/w500',
  CACHE_KEY: 'nflx_trending_cache',
  CACHE_TTL: 6 * 60 * 60 * 1000, // 6 tiếng (cache để giảm số lần gọi API)

  _getApiKey() {
    return CONFIG.TMDB?.API_KEY || '';
  },

  _getCached() {
    try {
      const raw = localStorage.getItem(this.CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (Date.now() - cached.timestamp > this.CACHE_TTL) {
        localStorage.removeItem(this.CACHE_KEY);
        return null;
      }
      return cached.movies;
    } catch {
      return null;
    }
  },

  _setCache(movies) {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        movies,
      }));
    } catch { /* ignore */ }
  },

  async fetchTrending() {
    const apiKey = this._getApiKey();
    if (!apiKey) {
      console.warn('[Trending] TMDB API key chưa được cấu hình trong CONFIG.TMDB.API_KEY');
      return null;
    }

    // Kiểm tra cache trước
    const cached = this._getCached();
    if (cached) {
      console.log('[Trending] Sử dụng dữ liệu từ cache');
      return cached;
    }

    try {
      const url = `${this.TMDB_BASE}/trending/movie/day?api_key=${apiKey}&language=vi-VN&page=1`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`TMDB API error ${res.status}`);
      const data = await res.json();

      // Lọc lấy 5 phim đầu tiên có poster
      const movies = (data.results || [])
        .filter(m => m.poster_path)
        .slice(0, 5)
        .map((m, i) => ({
          title: m.title || m.name || 'Không rõ tên',
          poster: `${this.TMDB_IMG}${m.poster_path}`,
          rating: m.vote_average ? m.vote_average.toFixed(1) : null,
          year: (m.release_date || m.first_air_date || '').slice(0, 4),
          rank: i + 1,
          overview: (m.overview || '').slice(0, 120),
        }));

      this._setCache(movies);
      console.log('[Trending] Đã fetch thành công', movies.length, 'phim');
      return movies;
    } catch (err) {
      console.error('[Trending] Lỗi khi fetch:', err);
      return null;
    }
  },

  renderMovies(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    this.fetchTrending().then(movies => {
      if (!movies || movies.length === 0) return; // Giữ nguyên poster mặc định nếu lỗi

      container.innerHTML = movies.map((movie, idx) => `
        <div class="relative aspect-[2/3] rounded-lg overflow-hidden group cursor-pointer">
          <img alt="${movie.title}" loading="lazy"
            class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            src="${movie.poster}" />
          <div class="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60"></div>
          <div class="absolute bottom-0 left-0 right-0 p-3">
            ${movie.rank === 1 ? '<span class="text-[10px] font-black bg-red-600 px-2 py-0.5 rounded-sm mb-1 inline-block">TOP 1</span>' : ''}
            <h4 class="text-sm font-bold leading-tight line-clamp-2 drop-shadow-lg">${movie.title}</h4>
            <div class="flex items-center gap-2 mt-1">
              ${movie.rating ? `<span class="text-[10px] text-yellow-400 font-bold flex items-center gap-0.5"><span class="material-symbols-outlined fill-1 text-xs">star</span>${movie.rating}</span>` : ''}
              ${movie.year ? `<span class="text-[10px] text-zinc-400">${movie.year}</span>` : ''}
            </div>
          </div>
          <div class="absolute top-2 left-2">
            <span class="text-3xl font-black font-manrope text-white/20 leading-none drop-shadow-lg">${movie.rank}</span>
          </div>
        </div>
      `).join('');
    });
  },
};
