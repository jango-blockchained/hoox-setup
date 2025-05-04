/**
 * Route manager for handling route configuration storage and retrieval.
 */
import { RouteConfig, RoutesConfig, DEFAULT_ROUTES_CONFIG, ROUTES_CONFIG_KEY, validateRouteConfig } from './route-config';

/**
 * Manager for route configurations stored in KV.
 */
export class RouteManager {
  private cache: RoutesConfig | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minute cache TTL
  
  constructor(private kv: KVNamespace) {}
  
  /**
   * Get all routes from KV store or cache.
   */
  async getRoutes(): Promise<RoutesConfig> {
    // Check cache first
    if (this.cache && Date.now() < this.cacheExpiry) {
      return this.cache;
    }
    
    // Fetch from KV
    try {
      const routes = await this.kv.get(ROUTES_CONFIG_KEY, 'json') as RoutesConfig | null;
      
      if (!routes) {
        // No config found, use default and save it
        await this.kv.put(ROUTES_CONFIG_KEY, JSON.stringify(DEFAULT_ROUTES_CONFIG));
        this.cache = DEFAULT_ROUTES_CONFIG;
      } else {
        this.cache = routes;
      }
      
      this.cacheExpiry = Date.now() + this.CACHE_TTL;
      return this.cache;
    } catch (error) {
      console.error('Error fetching routes from KV:', error);
      return DEFAULT_ROUTES_CONFIG;
    }
  }
  
  /**
   * Get a specific route by path.
   */
  async getRoute(routePath: string): Promise<RouteConfig | null> {
    const routes = await this.getRoutes();
    return routes.routes[routePath] || null;
  }
  
  /**
   * Add or update a route.
   */
  async addRoute(routePath: string, route: RouteConfig): Promise<{ success: boolean; errors?: string[] }> {
    // Validate route
    const validation = validateRouteConfig(route);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }
    
    try {
      // Get current routes
      const routes = await this.getRoutes();
      
      // Add/update the route
      routes.routes[routePath] = route;
      routes.lastUpdated = new Date().toISOString();
      
      // Save to KV
      await this.kv.put(ROUTES_CONFIG_KEY, JSON.stringify(routes));
      
      // Update cache
      this.cache = routes;
      this.cacheExpiry = Date.now() + this.CACHE_TTL;
      
      return { success: true };
    } catch (error) {
      console.error(`Error adding route "${routePath}":`, error);
      return { success: false, errors: ['Failed to save route to KV store'] };
    }
  }
  
  /**
   * Delete a route.
   */
  async deleteRoute(routePath: string): Promise<boolean> {
    try {
      // Get current routes
      const routes = await this.getRoutes();
      
      // Check if route exists
      if (!routes.routes[routePath]) {
        return false;
      }
      
      // Delete the route
      delete routes.routes[routePath];
      routes.lastUpdated = new Date().toISOString();
      
      // Save to KV
      await this.kv.put(ROUTES_CONFIG_KEY, JSON.stringify(routes));
      
      // Update cache
      this.cache = routes;
      this.cacheExpiry = Date.now() + this.CACHE_TTL;
      
      return true;
    } catch (error) {
      console.error(`Error deleting route "${routePath}":`, error);
      return false;
    }
  }
  
  /**
   * Find a matching route for a request path.
   */
  async findMatchingRoute(requestPath: string, method: string): Promise<{ route: RouteConfig; params: Record<string, string> } | null> {
    const routes = await this.getRoutes();
    
    // First check for exact matches
    if (routes.routes[requestPath] && routes.routes[requestPath].methods.includes(method)) {
      return { route: routes.routes[requestPath], params: {} };
    }
    
    // Then check for parameter matches (e.g., /users/:id)
    for (const [path, route] of Object.entries(routes.routes)) {
      if (!route.methods.includes(method)) {
        continue;
      }
      
      const params: Record<string, string> = {};
      const isMatch = this.matchPathWithParams(path, requestPath, params);
      
      if (isMatch) {
        return { route, params };
      }
    }
    
    return null;
  }
  
  /**
   * Match a path with parameters, e.g., /users/:id -> /users/123
   */
  private matchPathWithParams(pattern: string, path: string, params: Record<string, string>): boolean {
    // Split both paths into segments
    const patternSegments = pattern.split('/').filter(Boolean);
    const pathSegments = path.split('/').filter(Boolean);
    
    // Quick length check
    if (patternSegments.length !== pathSegments.length) {
      return false;
    }
    
    // Check each segment
    for (let i = 0; i < patternSegments.length; i++) {
      const patternSegment = patternSegments[i];
      const pathSegment = pathSegments[i];
      
      // If it's a parameter
      if (patternSegment.startsWith(':')) {
        const paramName = patternSegment.substring(1);
        params[paramName] = pathSegment;
      } 
      // Otherwise, must match exactly
      else if (patternSegment !== pathSegment) {
        return false;
      }
    }
    
    return true;
  }
} 