import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, interval, Observable, map, catchError, of, retry, timer, switchMap } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

interface ExchangeRatesResponse {
  disclaimer: string;
  license: string;
  timestamp: number;
  base: string;
  rates: { [currency: string]: number };
}

interface CurrencyRates {
  [fromCurrency: string]: { [toCurrency: string]: number };
}

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  http = inject(HttpClient);
  platformId = inject(PLATFORM_ID);
  ratesSubject = new BehaviorSubject<CurrencyRates>({});
  loadingSubject = new BehaviorSubject<boolean>(false);
  supportedCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'NGN'];
  intervalSubscription: any;
  
  rates$ = this.ratesSubject.asObservable();
  loading$ = this.loadingSubject.asObservable();

  constructor() {
    this.loadStoredRates();
    if (isPlatformBrowser(this.platformId) && Object.keys(this.ratesSubject.value).length === 0) {
      this.fetchRatesWithRetry();
    }
  }

  loadStoredRates(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const stored = localStorage.getItem('currency-rates');
    const lastFetch = localStorage.getItem('last-fetch-time');
    
    if (stored && lastFetch) {
      const rates = JSON.parse(stored);
      this.ratesSubject.next(rates);
      
      const hoursSinceLastFetch = (Date.now() - parseInt(lastFetch)) / (1000 * 60 * 60);
      if (hoursSinceLastFetch >= 1) {
        this.fetchRates();
      }
    }
  }

  startFetching(): void {
    if (Object.keys(this.ratesSubject.value).length === 0) {
      this.fetchRatesWithRetry();
    }
    
    if (!this.intervalSubscription) {
      this.intervalSubscription = interval(3600000).subscribe(() => this.fetchRatesWithRetry());
    }
  }

  fetchRates(): void {
    const url = environment.exchangeRatesApiUrl;
    
    this.http.get<ExchangeRatesResponse>(url)
      .pipe(
        map(response => this.processRates(response.rates)),
        catchError(() => of({}))
      )
      .subscribe(rates => {
        if (Object.keys(rates).length > 0) {
          this.ratesSubject.next(rates);
          this.loadingSubject.next(false);
          if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem('currency-rates', JSON.stringify(rates));
            localStorage.setItem('last-fetch-time', Date.now().toString());
          }
        }
      });
  }

  fetchRatesWithRetry(): void {
    this.loadingSubject.next(true);
    const url = environment.exchangeRatesApiUrl;
    
    timer(0, 5000)
      .pipe(
        switchMap(() => this.http.get<ExchangeRatesResponse>(url)),
        map(response => this.processRates(response.rates)),
        catchError(() => of(null))
      )
      .subscribe(rates => {
        if (rates && Object.keys(rates).length > 0) {
          this.ratesSubject.next(rates);
          this.loadingSubject.next(false);
          if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem('currency-rates', JSON.stringify(rates));
            localStorage.setItem('last-fetch-time', Date.now().toString());
          }
        }
      });
  }

  processRates(usdRates: { [currency: string]: number }): CurrencyRates {
    const processedRates: CurrencyRates = {};
    
    this.supportedCurrencies.forEach(fromCurrency => {
      processedRates[fromCurrency] = {};
      
      this.supportedCurrencies.forEach(toCurrency => {
        if (fromCurrency === toCurrency) {
          processedRates[fromCurrency][toCurrency] = 1;
        } else if (fromCurrency === 'USD') {
          processedRates[fromCurrency][toCurrency] = usdRates[toCurrency] || 0;
        } else if (toCurrency === 'USD') {
          processedRates[fromCurrency][toCurrency] = 1 / (usdRates[fromCurrency] || 1);
        } else {
          const fromUsdRate = usdRates[fromCurrency] || 1;
          const toUsdRate = usdRates[toCurrency] || 1;
          processedRates[fromCurrency][toCurrency] = toUsdRate / fromUsdRate;
        }
      });
    });
    
    return processedRates;
  }

  convert(fromCurrency: string, toCurrency: string, amount: number): number {
    const currentRates = this.ratesSubject.value;
    const rate = currentRates[fromCurrency]?.[toCurrency] || 0;
    return amount * rate;
  }

  getSupportedCurrencies(): string[] {
    return [...this.supportedCurrencies];
  }
}