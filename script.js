// --- Elementos del DOM ---
const loanForm = document.getElementById('loanForm');
const inputAmount = document.getElementById('inputAmount');
const inputRate = document.getElementById('inputRate');
const inputTerm = document.getElementById('inputTerm');
const btnCalculate = document.getElementById('btnCalculate');
const btnReset = document.getElementById('btnReset');
const btnExport = document.getElementById('btnExport');

const tabFrench = document.getElementById('tabFrench');
const tabGerman = document.getElementById('tabGerman');

// Elementos de Métricas
const metricMonthlyPayment = document.getElementById('metricMonthlyPayment');
const metricMonthlyDetail = document.getElementById('metricMonthlyDetail');
const metricTotalInterest = document.getElementById('metricTotalInterest');
const metricTotalPaid = document.getElementById('metricTotalPaid');
const metricInterestRatioBar = document.getElementById('metricInterestRatioBar');
const metricInterestRatioText = document.getElementById('metricInterestRatioText');

// Elementos de la Tabla
const amortizationTableBody = document.getElementById('amortizationTableBody');
const tableEmptyState = document.getElementById('tableEmptyState');

// Elementos del Gráfico
const balanceChartCanvas = document.getElementById('balanceChart');
const chartPlaceholder = document.getElementById('chartPlaceholder');

// Elementos de Comparación
const comparisonCard = document.getElementById('comparisonCard');
const comparisonBenefitText = document.getElementById('comparisonBenefitText');
const compFrenchInterest = document.getElementById('compFrenchInterest');
const compGermanInterest = document.getElementById('compGermanInterest');
const compDifference = document.getElementById('compDifference');

// --- Mensajes de Error de Validación ---
const errorAmount = document.getElementById('errorAmount');
const errorRate = document.getElementById('errorRate');
const errorTerm = document.getElementById('errorTerm');

// --- Estado de la Aplicación ---
let selectedMethod = 'french'; // 'french' o 'german'
let chartInstance = null;
let activeSimulations = null; // Almacenará ambos cálculos para permitir cambios de tab rápidos y comparaciones

// --- Formateador de Moneda y Porcentajes ---
const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

const formatPercent = (value) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
};

// --- Manejador de Pestañas (Métodos de Amortización) ---
const setMethod = (method) => {
  selectedMethod = method;
  
  if (method === 'french') {
    tabFrench.className = 'py-2.5 px-3 rounded-lg text-sm font-bold transition-all text-center focus:outline-none bg-indigo-600 text-white shadow-md shadow-indigo-600/10';
    tabGerman.className = 'py-2.5 px-3 rounded-lg text-sm font-bold transition-all text-center focus:outline-none text-slate-400 hover:text-white';
    metricMonthlyDetail.textContent = 'Cuota mensual fija uniforme';
  } else {
    tabGerman.className = 'py-2.5 px-3 rounded-lg text-sm font-bold transition-all text-center focus:outline-none bg-emerald-600 text-white shadow-md shadow-emerald-600/10';
    tabFrench.className = 'py-2.5 px-3 rounded-lg text-sm font-bold transition-all text-center focus:outline-none text-slate-400 hover:text-white';
    metricMonthlyDetail.textContent = 'Cuota inicial decreciente';
  }

  // Si ya hay datos simulados, actualizamos la vista de inmediato sin obligar a presionar "Calcular" de nuevo
  if (activeSimulations) {
    updateUI();
  }
};

tabFrench.addEventListener('click', () => setMethod('french'));
tabGerman.addEventListener('click', () => setMethod('german'));

// --- Cálculos Financieros ---

/**
 * Calcula la tabla de amortización por el Método Francés (cuota fija)
 */
const calculateFrench = (principal, annualRate, months) => {
  const monthlyRate = annualRate / 12 / 100;
  const schedule = [];
  let balance = principal;
  let totalInterest = 0;
  
  // Cálculo de cuota fija (French formula)
  let monthlyPayment = 0;
  if (monthlyRate === 0) {
    monthlyPayment = principal / months;
  } else {
    monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
  }

  for (let i = 1; i <= months; i++) {
    const interest = balance * monthlyRate;
    let amortization = monthlyPayment - interest;
    
    // Controlar precisión flotante en la última cuota
    if (i === months) {
      amortization = balance;
      monthlyPayment = amortization + interest;
      balance = 0;
    } else {
      balance = balance - amortization;
    }

    totalInterest += interest;

    schedule.push({
      period: i,
      payment: monthlyPayment,
      interest: interest,
      amortization: amortization,
      remainingBalance: Math.max(0, balance)
    });
  }

  return {
    method: 'french',
    schedule,
    totalInterest,
    totalPaid: principal + totalInterest,
    averagePayment: monthlyPayment,
    initialPayment: monthlyPayment
  };
};

/**
 * Calcula la tabla de amortización por el Método Alemán (amortización constante)
 */
const calculateGerman = (principal, annualRate, months) => {
  const monthlyRate = annualRate / 12 / 100;
  const schedule = [];
  let balance = principal;
  let totalInterest = 0;
  
  // Amortización fija constante
  const amortizationConstant = principal / months;

  for (let i = 1; i <= months; i++) {
    const interest = balance * monthlyRate;
    let amortization = amortizationConstant;
    let payment = amortization + interest;

    // Controlar precisión en el último mes
    if (i === months) {
      amortization = balance;
      payment = amortization + interest;
      balance = 0;
    } else {
      balance = balance - amortization;
    }

    totalInterest += interest;

    schedule.push({
      period: i,
      payment: payment,
      interest: interest,
      amortization: amortization,
      remainingBalance: Math.max(0, balance)
    });
  }

  const averagePayment = (principal + totalInterest) / months;

  return {
    method: 'german',
    schedule,
    totalInterest,
    totalPaid: principal + totalInterest,
    averagePayment,
    initialPayment: schedule[0].payment
  };
};

// --- Validaciones de Entrada ---
const validateInputs = () => {
  let isValid = true;

  const amountValue = parseFloat(inputAmount.value);
  const rateValue = parseFloat(inputRate.value);
  const termValue = parseInt(inputTerm.value);

  // Validar Monto
  if (isNaN(amountValue) || amountValue <= 0) {
    errorAmount.textContent = 'Por favor ingresa un monto válido mayor a 0.';
    errorAmount.classList.remove('hidden');
    inputAmount.classList.add('border-rose-500', 'focus:ring-rose-500');
    isValid = false;
  } else {
    errorAmount.classList.add('hidden');
    inputAmount.classList.remove('border-rose-500', 'focus:ring-rose-500');
  }

  // Validar Tasa de Interés
  if (isNaN(rateValue) || rateValue < 0 || rateValue > 100) {
    errorRate.textContent = 'La tasa de interés debe estar entre 0% y 100%.';
    errorRate.classList.remove('hidden');
    inputRate.classList.add('border-rose-500', 'focus:ring-rose-500');
    isValid = false;
  } else {
    errorRate.classList.add('hidden');
    inputRate.classList.remove('border-rose-500', 'focus:ring-rose-500');
  }

  // Validar Plazo
  if (isNaN(termValue) || termValue < 1 || termValue > 360) {
    errorTerm.textContent = 'El plazo debe ser de entre 1 y 360 meses (30 años).';
    errorTerm.classList.remove('hidden');
    inputTerm.classList.add('border-rose-500', 'focus:ring-rose-500');
    isValid = false;
  } else {
    errorTerm.classList.add('hidden');
    inputTerm.classList.remove('border-rose-500', 'focus:ring-rose-500');
  }

  return isValid;
};

// Limpiar estados de error al escribir
[inputAmount, inputRate, inputTerm].forEach(input => {
  input.addEventListener('input', () => {
    validateInputs();
  });
});

// --- Actualización de la Interfaz Gráfica ---

/**
 * Renderiza la tabla de amortización en el DOM
 */
const renderTable = (schedule) => {
  // Limpiar tabla
  amortizationTableBody.innerHTML = '';
  
  if (schedule.length === 0) {
    amortizationTableBody.appendChild(tableEmptyState);
    return;
  }

  // Crear fragmento para optimizar la inserción en el DOM
  const fragment = document.createDocumentFragment();

  schedule.forEach((row) => {
    const tr = document.createElement('tr');
    tr.className = 'table-row-alternate border-b border-white/5 transition-colors duration-150';
    
    tr.innerHTML = `
      <td class="px-6 py-4.5 font-bold text-indigo-400">${row.period}</td>
      <td class="px-6 py-4.5 font-semibold text-white">${formatCurrency(row.payment)}</td>
      <td class="px-6 py-4.5 text-purple-300 font-medium">${formatCurrency(row.interest)}</td>
      <td class="px-6 py-4.5 text-emerald-400 font-medium">${formatCurrency(row.amortization)}</td>
      <td class="px-6 py-4.5 text-slate-300 font-medium">${formatCurrency(row.remainingBalance)}</td>
    `;
    fragment.appendChild(tr);
  });

  amortizationTableBody.appendChild(fragment);
};

/**
 * Renderiza el gráfico interactivo de la evolución de la deuda con Chart.js
 */
const renderChart = (schedule, principal) => {
  // Destruir gráfico anterior si existe
  if (chartInstance) {
    chartInstance.destroy();
  }

  // Ocultar placeholder del gráfico y mostrar lienzo
  chartPlaceholder.classList.add('opacity-0', 'pointer-events-none');
  balanceChartCanvas.classList.remove('opacity-0');

  // Preparar datos
  const labels = ['Inicio', ...schedule.map(row => `Mes ${row.period}`)];
  const remainingBalanceData = [principal, ...schedule.map(row => Math.round(row.remainingBalance * 100) / 100)];
  
  // Calcular capital acumulado amortizado
  let accumulatedAmortization = 0;
  const amortizationData = [0, ...schedule.map(row => {
    accumulatedAmortization += row.amortization;
    return Math.round(accumulatedAmortization * 100) / 100;
  })];

  const ctx = balanceChartCanvas.getContext('2d');

  // Crear gradientes espectaculares para el área del gráfico
  const balanceGradient = ctx.createLinearGradient(0, 0, 0, 300);
  balanceGradient.addColorStop(0, 'rgba(99, 102, 241, 0.25)'); // Indigo
  balanceGradient.addColorStop(1, 'rgba(99, 102, 241, 0.00)');

  const amortGradient = ctx.createLinearGradient(0, 0, 0, 300);
  amortGradient.addColorStop(0, 'rgba(16, 185, 129, 0.20)'); // Emerald
  amortGradient.addColorStop(1, 'rgba(16, 185, 129, 0.00)');

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Saldo de la Deuda',
          data: remainingBalanceData,
          borderColor: '#6366f1', // Indigo
          borderWidth: 3,
          pointBackgroundColor: '#6366f1',
          pointHoverRadius: 7,
          pointRadius: 1,
          pointHitRadius: 10,
          fill: true,
          backgroundColor: balanceGradient,
          tension: 0.4,
        },
        {
          label: 'Capital Pagado Acumulado',
          data: amortizationData,
          borderColor: '#10b981', // Emerald
          borderWidth: 2,
          borderDash: [5, 5],
          pointBackgroundColor: '#10b981',
          pointHoverRadius: 6,
          pointRadius: 0,
          pointHitRadius: 10,
          fill: true,
          backgroundColor: amortGradient,
          tension: 0.4,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false // Usamos nuestra propia leyenda estilizada arriba
        },
        tooltip: {
          backgroundColor: '#111827',
          titleColor: '#9ca3af',
          titleFont: {
            family: 'Plus Jakarta Sans',
            size: 11,
            weight: 'bold'
          },
          bodyColor: '#ffffff',
          bodyFont: {
            family: 'Plus Jakarta Sans',
            size: 13,
            weight: 'bold'
          },
          padding: 12,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          displayColors: true,
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += formatCurrency(context.parsed.y);
              }
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.03)',
            drawBorder: false
          },
          ticks: {
            color: '#9ca3af',
            font: {
              family: 'Plus Jakarta Sans',
              size: 10
            },
            maxTicksLimit: 12 // Limita el número de ticks para pantallas pequeñas
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
            drawBorder: false
          },
          ticks: {
            color: '#9ca3af',
            font: {
              family: 'Plus Jakarta Sans',
              size: 10
            },
            callback: function(value) {
              return formatCurrency(value).split(',')[0]; // Simplificar leyenda
            }
          }
        }
      }
    }
  });
};

/**
 * Actualiza los elementos visuales de acuerdo al método activo y las simulaciones calculadas
 */
const updateUI = () => {
  if (!activeSimulations) return;

  const data = selectedMethod === 'french' ? activeSimulations.french : activeSimulations.german;

  // 1. Actualizar Tarjetas de Métricas
  if (selectedMethod === 'french') {
    metricMonthlyPayment.textContent = formatCurrency(data.averagePayment);
  } else {
    // Para el alemán, la cuota varía, mostramos rango "Inicial -> Final"
    const schedule = data.schedule;
    const initialPayment = schedule[0].payment;
    const finalPayment = schedule[schedule.length - 1].payment;
    metricMonthlyPayment.textContent = `${formatCurrency(initialPayment)}`;
  }
  
  metricTotalInterest.textContent = formatCurrency(data.totalInterest);
  metricTotalPaid.textContent = formatCurrency(data.totalPaid);

  // Relación Interés / Capital
  const principal = activeSimulations.principal;
  const interestRatio = (data.totalInterest / principal) * 100;
  metricInterestRatioBar.style.width = `${Math.min(100, interestRatio)}%`;
  metricInterestRatioText.textContent = `${interestRatio.toFixed(1)}%`;

  // Colores de la barra en base a la relación
  if (interestRatio < 15) {
    metricInterestRatioBar.className = 'bg-gradient-to-r from-emerald-500 to-indigo-500 h-1.5 rounded-full transition-all duration-500';
  } else if (interestRatio < 40) {
    metricInterestRatioBar.className = 'bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full transition-all duration-500';
  } else {
    metricInterestRatioBar.className = 'bg-gradient-to-r from-purple-500 to-rose-500 h-1.5 rounded-full transition-all duration-500';
  }

  // 2. Renderizar Tabla y Gráfico
  renderTable(data.schedule);
  renderChart(data.schedule, principal);

  // Habilitar botón de exportación
  btnExport.disabled = false;
};

/**
 * Actualiza la sección de comparación inteligente (Educación Financiera en Tiempo Real)
 */
const updateComparisonCard = (french, german) => {
  compFrenchInterest.textContent = formatCurrency(french.totalInterest);
  compGermanInterest.textContent = formatCurrency(german.totalInterest);

  const diff = french.totalInterest - german.totalInterest;

  comparisonCard.classList.remove('hidden');

  if (diff > 0.01) {
    compDifference.textContent = formatCurrency(diff);
    compDifference.className = 'text-emerald-400 font-bold';
    comparisonBenefitText.innerHTML = `Con el <strong>Método Alemán</strong> pagas un total de <span class="text-emerald-400 font-bold">${formatCurrency(diff)} MENOS</span> en intereses que con el Método Francés.`;
  } else if (diff < -0.01) {
    // Caso improbable con tasas normales, pero para robustez matemática
    compDifference.textContent = formatCurrency(Math.abs(diff));
    compDifference.className = 'text-indigo-400 font-bold';
    comparisonBenefitText.innerHTML = `Con el <strong>Método Francés</strong> pagas <span class="text-indigo-400 font-bold">${formatCurrency(Math.abs(diff))} MENOS</span> en intereses totales.`;
  } else {
    compDifference.textContent = '$0.00';
    compDifference.className = 'text-slate-300 font-semibold';
    comparisonBenefitText.innerHTML = `Ambos sistemas generan el mismo cobro de intereses bajo estas condiciones específicas.`;
  }
};

// --- Procesar y Calcular ---
const handleCalculate = () => {
  if (!validateInputs()) return;

  const principal = parseFloat(inputAmount.value);
  const annualRate = parseFloat(inputRate.value);
  const months = parseInt(inputTerm.value);

  // Ejecutar simulaciones para ambos sistemas
  const frenchSim = calculateFrench(principal, annualRate, months);
  const germanSim = calculateGerman(principal, annualRate, months);

  activeSimulations = {
    principal,
    annualRate,
    months,
    french: frenchSim,
    german: germanSim
  };

  // Actualizar tarjeta comparativa
  updateComparisonCard(frenchSim, germanSim);

  // Actualizar UI
  updateUI();

  // Scroll sutil hacia las métricas si es celular para dar feedback inmediato de cálculo
  if (window.innerWidth < 1024) {
    document.getElementById('metricMonthlyPayment').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

loanForm.addEventListener('submit', (e) => {
  e.preventDefault();
  handleCalculate();
});

// --- Exportación a CSV ---
const exportToCSV = () => {
  if (!activeSimulations) return;

  const data = selectedMethod === 'french' ? activeSimulations.french : activeSimulations.german;
  const schedule = data.schedule;

  // Cabecera CSV
  let csvContent = "\uFEFF"; // BOM para soportar correctamente caracteres en Excel
  csvContent += "N. Cuota,Cuota Mensual,Interes,Capital Amortizado,Saldo Restante\n";

  // Rellenar filas
  schedule.forEach((row) => {
    csvContent += `${row.period},${row.payment.toFixed(2)},${row.interest.toFixed(2)},${row.amortization.toFixed(2)},${row.remainingBalance.toFixed(2)}\n`;
  });

  // Crear archivo y descargar
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const formattedMethod = selectedMethod === 'french' ? 'FRANCES' : 'ALEMAN';
  const filename = `Amortizacion_${formattedMethod}_Monto_${activeSimulations.principal}_Tasa_${activeSimulations.annualRate}pct.csv`;

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

btnExport.addEventListener('click', exportToCSV);

// --- Reset / Limpieza ---
const handleReset = () => {
  // Limpiar inputs
  inputAmount.value = '';
  inputRate.value = '';
  inputTerm.value = '';

  // Limpiar validaciones
  errorAmount.classList.add('hidden');
  errorRate.classList.add('hidden');
  errorTerm.classList.add('hidden');
  
  inputAmount.classList.remove('border-rose-500', 'focus:ring-rose-500');
  inputRate.classList.remove('border-rose-500', 'focus:ring-rose-500');
  inputTerm.classList.remove('border-rose-500', 'focus:ring-rose-500');

  // Limpiar Estado
  activeSimulations = null;

  // Restaurar Tarjetas de Métricas a cero
  metricMonthlyPayment.textContent = '$0.00';
  metricTotalInterest.textContent = '$0.00';
  metricTotalPaid.textContent = '$0.00';
  metricInterestRatioBar.style.width = '0%';
  metricInterestRatioText.textContent = '0%';

  // Restaurar Tabla a estado vacío
  amortizationTableBody.innerHTML = '';
  amortizationTableBody.appendChild(tableEmptyState);

  // Destruir gráfico
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  chartPlaceholder.classList.remove('opacity-0', 'pointer-events-none');
  balanceChartCanvas.classList.add('opacity-0');

  // Ocultar tarjeta comparativa
  comparisonCard.classList.add('hidden');

  // Deshabilitar botón de exportación
  btnExport.disabled = true;

  // Volver a pestaña por defecto (francés)
  setMethod('french');
};

btnReset.addEventListener('click', handleReset);
