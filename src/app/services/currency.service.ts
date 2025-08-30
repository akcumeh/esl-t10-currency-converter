import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, interval, Observable, map, catchError, of } from 'rxjs';
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
  ratesSubject = new BehaviorSubject<CurrencyRates>({});
  supportedCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'NGN'];
  
  rates$ = this.ratesSubject.asObservable();

  constructor() {
  }

  startFetching(): void {
    if (Object.keys(this.ratesSubject.value).length === 0) {
      this.fetchRates();
      interval(3600000).subscribe(() => this.fetchRates());
    }
  }

  fetchRates(): void {
    const url = `${environment.openExchangeRatesApiUrl}?app_id=${environment.openExchangeRatesApiKey}`;
    
    this.http.get<ExchangeRatesResponse>(url)
      .pipe(
        map(response => this.processRates(response.rates)),
        catchError(() => of({}))
      )
      .subscribe(rates => this.ratesSubject.next(rates));
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