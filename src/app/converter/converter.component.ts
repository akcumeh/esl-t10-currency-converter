import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { CurrencyService } from '../services/currency.service';

@Component({
  selector: 'app-converter',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './converter.component.html',
  styleUrl: './converter.component.scss'
})
export class ConverterComponent {
  fb = inject(FormBuilder);
  currencyService = inject(CurrencyService);
  
  converterForm: FormGroup;
  currencies = [
    { code: 'USD', name: 'US Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' },
    { code: 'JPY', name: 'Japanese Yen' },
    { code: 'NGN', name: 'Nigerian Naira' }
  ];
  convertedValue: string = '';
  isLoading: boolean = false;

  constructor() {
    this.converterForm = this.fb.group({
      amount: ['1000', [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)]],
      fromCurrency: ['USD', Validators.required],
      toCurrency: ['EUR', Validators.required]
    });

    this.converterForm.get('amount')?.valueChanges.subscribe(() => {
      this.currencyService.startFetching();
    });
  }

  onConvert() {
    if (this.converterForm.valid) {
      const { amount, fromCurrency, toCurrency } = this.converterForm.value;
      
      if (fromCurrency === toCurrency) {
        this.convertedValue = amount;
        return;
      }

      this.isLoading = true;
      
      const numericAmount = parseFloat(amount);
      const result = this.currencyService.convert(fromCurrency, toCurrency, numericAmount);
      
      if (result > 0) {
        this.convertedValue = result.toFixed(2);
      } else {
        this.convertedValue = 'Rates not available';
      }
      
      this.isLoading = false;
    }
  }

  onSubmit(event: Event) {
    event.preventDefault();
    this.onConvert();
  }
}
