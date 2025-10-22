// 年収予測アプリケーション
class SalaryPredictor {
    constructor() {
        this.salaryData = null;
        this.form = document.getElementById('salaryForm');
        this.resultsContainer = document.getElementById('resultsContainer');
        
        this.init();
    }

    async init() {
        try {
            // ローディング表示
            this.showInitializationStatus('データを読み込み中...');
            
            await this.loadSalaryData();
            this.bindEvents();
            
            // 成功時にローディングを隠す
            this.hideInitializationStatus();
            console.log('年収予測アプリが初期化されました');
            
            // 成功メッセージを表示
            setTimeout(() => {
                this.showToast('アプリケーションの準備が完了しました！', 'success');
            }, 500);
            
        } catch (error) {
            console.error('アプリケーションの初期化に失敗しました:', error);
            this.hideInitializationStatus();
            this.showError(error.message || 'データの読み込みに失敗しました。ページを再読み込みしてください。');
            
            // リトライボタンを表示
            this.showRetryOption();
        }
    }

    async loadSalaryData() {
        try {
            console.log('データ読み込み開始:', new Date().toISOString());
            
            const response = await fetch('salary-data.json');
            console.log('Fetch Response:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                url: response.url
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            }
            
            const text = await response.text();
            console.log('Raw response length:', text.length);
            
            this.salaryData = JSON.parse(text);
            console.log('データ読み込み成功:', Object.keys(this.salaryData));
            
        } catch (error) {
            console.error('給与データの読み込みエラー詳細:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            
            // より具体的なエラーメッセージを表示
            if (error.name === 'SyntaxError') {
                throw new Error('データファイルの形式が正しくありません。管理者に連絡してください。');
            } else if (error.message.includes('404')) {
                throw new Error('データファイル（salary-data.json）が見つかりません。ファイルが存在することを確認してください。');
            } else if (error.message.includes('Failed to fetch')) {
                throw new Error('ネットワークエラーです。インターネット接続を確認するか、ローカルサーバーを使用してください。');
            } else {
                throw new Error(`データ読み込みエラー: ${error.message}`);
            }
        }
    }

    bindEvents() {
        if (this.form) {
            this.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmit();
            });
        }
    }

    async handleFormSubmit() {
        const formData = this.getFormData();
        
        if (!this.validateFormData(formData)) {
            return;
        }

        try {
            this.showLoading(true);
            
            // 予測計算を実行
            const predictions = this.calculateSalaryPredictions(formData);
            
            // 結果を表示
            await this.displayResults(predictions, formData);
            
        } catch (error) {
            console.error('予測計算エラー:', error);
            this.showError('予測計算中にエラーが発生しました。');
        } finally {
            this.showLoading(false);
        }
    }

    getFormData() {
        const formData = new FormData(this.form);
        return {
            education: formData.get('education'),
            experience: formData.get('experience'),
            jobCategory: formData.get('jobCategory'),
            industry: formData.get('industry')
        };
    }

    validateFormData(data) {
        const { education, experience, jobCategory, industry } = data;
        
        if (!education || !experience || !jobCategory || !industry) {
            this.showError('すべての項目を選択してください。');
            return false;
        }
        
        return true;
    }

    calculateSalaryPredictions(formData) {
        const { education, experience, jobCategory, industry } = formData;
        
        // 日本とアメリカの基本年収を取得
        const japanBaseSalary = this.salaryData.salaryData.japan[jobCategory][education][experience];
        const usaBaseSalary = this.salaryData.salaryData.usa[jobCategory][education][experience];
        
        // 業界補正係数を適用
        const japanMultiplier = this.salaryData.industryMultipliers.japan[industry] || 1.0;
        const usaMultiplier = this.salaryData.industryMultipliers.usa[industry] || 1.0;
        
        const japanAdjustedSalary = Math.round(japanBaseSalary * japanMultiplier);
        const usaAdjustedSalary = Math.round(usaBaseSalary * usaMultiplier);
        
        // 業界平均との比較
        const japanAverage = this.salaryData.industryAverages.japan[jobCategory];
        const usaAverage = this.salaryData.industryAverages.usa[jobCategory];
        
        // 手取り計算
        const japanNetSalary = this.calculateNetSalary(japanAdjustedSalary, 'japan');
        const usaNetSalary = this.calculateNetSalary(usaAdjustedSalary, 'usa');
        
        return {
            japan: {
                grossSalary: japanAdjustedSalary,
                netSalary: japanNetSalary,
                monthlyNet: Math.round(japanNetSalary / 12),
                industryAverage: japanAverage,
                comparisonPercentage: this.calculateComparisonPercentage(japanAdjustedSalary, japanAverage),
                industryMultiplier: japanMultiplier
            },
            usa: {
                grossSalary: usaAdjustedSalary,
                netSalary: usaNetSalary,
                monthlyNet: Math.round(usaNetSalary / 12),
                industryAverage: usaAverage,
                comparisonPercentage: this.calculateComparisonPercentage(usaAdjustedSalary, usaAverage),
                industryMultiplier: usaMultiplier
            },
            industryInfo: {
                name: industry,
                description: this.salaryData.industryDescriptions[industry] || ''
            }
        };
    }

    calculateNetSalary(grossSalary, country) {
        const taxRates = this.salaryData.taxRates[country];
        let netSalary = grossSalary;
        
        if (country === 'japan') {
            const totalTaxRate = taxRates.incomeTax + taxRates.socialInsurance;
            netSalary = grossSalary * (1 - totalTaxRate);
        } else if (country === 'usa') {
            const totalTaxRate = taxRates.federalTax + taxRates.stateTax + taxRates.socialSecurity;
            netSalary = grossSalary * (1 - totalTaxRate);
        }
        
        return Math.round(netSalary);
    }

    calculateComparisonPercentage(salary, average) {
        const percentage = ((salary - average) / average) * 100;
        return Math.round(percentage);
    }

    async displayResults(predictions, formData) {
        // 結果表示をアニメーション付きで実行
        await this.animateResultsDisplay(predictions, formData);
    }

    async animateResultsDisplay(predictions, formData) {
        // 日本の結果を更新
        this.updateCountryResults('japan', predictions.japan);
        
        // アメリカの結果を更新
        this.updateCountryResults('usa', predictions.usa);
        
        // 補足情報を更新
        this.updateInsights(formData, predictions);
        
        // 業界情報を更新
        this.updateIndustryInfo(predictions);
        
        // 結果コンテナを表示
        this.resultsContainer.style.display = 'block';
        
        // スムーズスクロール
        setTimeout(() => {
            this.resultsContainer.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }, 300);
    }

    updateCountryResults(country, data) {
        const salaryElement = document.getElementById(`${country}Salary`);
        const monthlyElement = document.getElementById(`${country}Monthly`);
        const comparisonElement = document.getElementById(`${country}Comparison`);
        
        if (salaryElement) {
            salaryElement.textContent = this.formatCurrency(data.grossSalary, country);
        }
        
        if (monthlyElement) {
            monthlyElement.textContent = this.formatCurrency(data.monthlyNet, country);
        }
        
        if (comparisonElement) {
            const percentage = data.comparisonPercentage;
            const sign = percentage >= 0 ? '+' : '';
            const color = percentage >= 0 ? '#10b981' : '#ef4444';
            
            comparisonElement.innerHTML = `
                <span style="color: ${color}">
                    ${sign}${percentage}%
                </span>
            `;
        }
    }

    updateInsights(formData, predictions) {
        const insightsElement = document.getElementById('salaryInsights');
        
        if (!insightsElement) return;
        
        const japanSalary = predictions.japan.grossSalary;
        const usaSalary = predictions.usa.grossSalary;
        const ratio = (usaSalary / japanSalary).toFixed(1);
        
        const educationText = this.getEducationText(formData.education);
        const jobText = this.getJobText(formData.jobCategory);
        const experienceText = this.getExperienceText(formData.experience);
        const industryText = this.getIndustryText(formData.industry);
        
        const japanMultiplier = predictions.japan.industryMultiplier;
        const usaMultiplier = predictions.usa.industryMultiplier;
        
        const insights = `
            ${industryText}における${educationText}の${jobText}で${experienceText}の場合、
            アメリカの年収は日本の約${ratio}倍となっています。
            
            業界補正: 日本 ${japanMultiplier >= 1 ? '+' : ''}${((japanMultiplier - 1) * 100).toFixed(0)}%、
            アメリカ ${usaMultiplier >= 1 ? '+' : ''}${((usaMultiplier - 1) * 100).toFixed(0)}%
            
            ${predictions.industryInfo.description}
            
            ※生活費や税制の違いにより実際の生活水準は異なります。
            企業規模、地域、個人のスキルレベルにより実際の年収は大きく変動する可能性があります。
        `;
        
        insightsElement.textContent = insights.trim();
    }

    getEducationText(education) {
        const educationMap = {
            'high-school': '高校卒業',
            'vocational': '専門学校・短大卒業',
            'bachelor': '大学卒業',
            'master': '大学院修士課程修了',
            'phd': '大学院博士課程修了'
        };
        return educationMap[education] || education;
    }

    getJobText(jobCategory) {
        const jobMap = {
            'software-engineer': 'ソフトウェアエンジニア',
            'data-scientist': 'データサイエンティスト',
            'project-manager': 'プロジェクトマネージャー',
            'marketing': 'マーケティング職',
            'sales': '営業職',
            'finance': '財務・経理職',
            'hr': '人事職',
            'consultant': 'コンサルタント',
            'designer': 'デザイナー',
            'researcher': '研究職'
        };
        return jobMap[jobCategory] || jobCategory;
    }

    getExperienceText(experience) {
        const experienceMap = {
            '0-2': '0-2年の経験',
            '3-5': '3-5年の経験',
            '6-10': '6-10年の経験',
            '11-15': '11-15年の経験',
            '16-20': '16-20年の経験',
            '20+': '20年以上の経験'
        };
        return experienceMap[experience] || experience;
    }

    getIndustryText(industry) {
        const industryMap = {
            'technology': 'テクノロジー・IT業界',
            'finance': '金融・銀行業界',
            'healthcare': '医療・ヘルスケア業界',
            'manufacturing': '製造業界',
            'consulting': 'コンサルティング業界',
            'retail': '小売・消費財業界',
            'energy': 'エネルギー・資源業界',
            'media': 'メディア・広告業界',
            'automotive': '自動車業界',
            'pharmaceutical': '製薬・バイオ業界',
            'education': '教育業界',
            'government': '公共・政府機関'
        };
        return industryMap[industry] || industry;
    }

    showInitializationStatus(message) {
        // 初期化ステータスの表示
        let statusDiv = document.getElementById('initializationStatus');
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.id = 'initializationStatus';
            statusDiv.className = 'initialization-status';
            document.body.appendChild(statusDiv);
        }
        
        statusDiv.innerHTML = `
            <div class="status-content">
                <div class="status-spinner"></div>
                <p>${message}</p>
            </div>
        `;
        statusDiv.style.display = 'flex';
    }

    hideInitializationStatus() {
        const statusDiv = document.getElementById('initializationStatus');
        if (statusDiv) {
            statusDiv.style.display = 'none';
        }
    }

    showRetryOption() {
        let retryDiv = document.getElementById('retryOption');
        if (!retryDiv) {
            retryDiv = document.createElement('div');
            retryDiv.id = 'retryOption';
            retryDiv.className = 'retry-option';
            document.body.appendChild(retryDiv);
        }
        
        retryDiv.innerHTML = `
            <div class="retry-content">
                <h3>⚠️ 初期化に失敗しました</h3>
                <p>データの読み込みに問題が発生しました。</p>
                <div class="retry-actions">
                    <button onclick="location.reload()" class="retry-btn primary">
                        <i class="fas fa-redo"></i> ページを再読み込み
                    </button>
                    <button onclick="window.salaryPredictor.init()" class="retry-btn secondary">
                        <i class="fas fa-sync"></i> 再試行
                    </button>
                </div>
                <div class="troubleshooting">
                    <h4>トラブルシューティング:</h4>
                    <ul>
                        <li>ローカルサーバーが起動していることを確認してください</li>
                        <li>ブラウザの開発者ツール（F12）でエラーの詳細を確認してください</li>
                        <li>salary-data.json ファイルが存在することを確認してください</li>
                    </ul>
                </div>
            </div>
        `;
        retryDiv.style.display = 'flex';
    }

    updateIndustryInfo(predictions) {
        const industryInfoCard = document.getElementById('industryInfoCard');
        const japanMultiplierElement = document.getElementById('japanMultiplier');
        const usaMultiplierElement = document.getElementById('usaMultiplier');
        const industryDescriptionElement = document.getElementById('industryDescription');
        
        if (!industryInfoCard) return;
        
        // 業界情報カードを表示
        industryInfoCard.style.display = 'block';
        
        // 業界補正係数を表示
        if (japanMultiplierElement) {
            const japanMultiplier = predictions.japan.industryMultiplier;
            const japanPercentage = ((japanMultiplier - 1) * 100).toFixed(0);
            const japanSign = japanMultiplier >= 1 ? '+' : '';
            
            japanMultiplierElement.textContent = `${japanSign}${japanPercentage}%`;
            japanMultiplierElement.className = `multiplier-value ${
                japanMultiplier > 1 ? 'positive' : 
                japanMultiplier < 1 ? 'negative' : 'neutral'
            }`;
        }
        
        if (usaMultiplierElement) {
            const usaMultiplier = predictions.usa.industryMultiplier;
            const usaPercentage = ((usaMultiplier - 1) * 100).toFixed(0);
            const usaSign = usaMultiplier >= 1 ? '+' : '';
            
            usaMultiplierElement.textContent = `${usaSign}${usaPercentage}%`;
            usaMultiplierElement.className = `multiplier-value ${
                usaMultiplier > 1 ? 'positive' : 
                usaMultiplier < 1 ? 'negative' : 'neutral'
            }`;
        }
        
        // 業界説明を表示
        if (industryDescriptionElement && predictions.industryInfo.description) {
            industryDescriptionElement.textContent = predictions.industryInfo.description;
        }
    }

    formatCurrency(amount, country) {
        if (country === 'japan') {
            return `¥${amount.toLocaleString('ja-JP')}`;
        } else {
            const usdAmount = Math.round(amount / this.salaryData.currencyRates.usdToJpy);
            return `$${usdAmount.toLocaleString('en-US')} (¥${amount.toLocaleString('ja-JP')})`;
        }
    }

    showLoading(show) {
        const button = this.form.querySelector('.predict-btn');
        
        if (show) {
            button.classList.add('loading');
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 計算中...';
        } else {
            button.classList.remove('loading');
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-calculator"></i> 年収を予測する';
        }
    }

    showError(message) {
        // エラー表示のためのトースト通知
        this.showToast(message, 'error');
    }

    showToast(message, type = 'info') {
        // 既存のトーストを削除
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        // アイコンマップ
        const iconMap = {
            'error': 'exclamation-circle',
            'success': 'check-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        
        // トースト要素を作成
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${iconMap[type] || 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        // 背景色マップ
        const colorMap = {
            'error': '#ef4444',
            'success': '#10b981',
            'warning': '#f59e0b',
            'info': '#3b82f6'
        };
        
        // スタイルを追加
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colorMap[type] || '#3b82f6'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
            z-index: 1000;
            animation: slideInRight 0.3s ease-out;
            max-width: 400px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;
        
        // CSSアニメーションを追加
        if (!document.querySelector('#toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                .toast-content {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                
                .initialization-status {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(15, 23, 42, 0.95);
                    backdrop-filter: blur(10px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    color: white;
                }
                
                .status-content {
                    text-align: center;
                    padding: 2rem;
                }
                
                .status-spinner {
                    width: 48px;
                    height: 48px;
                    border: 4px solid rgba(99, 102, 241, 0.2);
                    border-top: 4px solid #6366f1;
                    border-radius: 50%;
                    animation: modernSpin 1.2s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
                    margin: 0 auto 1rem;
                }
                
                .retry-option {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(15, 23, 42, 0.95);
                    backdrop-filter: blur(10px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    color: white;
                }
                
                .retry-content {
                    max-width: 500px;
                    padding: 2rem;
                    text-align: center;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                }
                
                .retry-actions {
                    display: flex;
                    gap: 1rem;
                    margin: 1.5rem 0;
                    justify-content: center;
                    flex-wrap: wrap;
                }
                
                .retry-btn {
                    padding: 0.8rem 1.5rem;
                    border: none;
                    border-radius: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                
                .retry-btn.primary {
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                    color: white;
                }
                
                .retry-btn.secondary {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                }
                
                .retry-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
                }
                
                .troubleshooting {
                    margin-top: 1.5rem;
                    text-align: left;
                    background: rgba(255, 255, 255, 0.05);
                    padding: 1rem;
                    border-radius: 8px;
                }
                
                .troubleshooting h4 {
                    margin-bottom: 0.5rem;
                    color: #fbbf24;
                }
                
                .troubleshooting ul {
                    margin: 0;
                    padding-left: 1.2rem;
                }
                
                .troubleshooting li {
                    margin-bottom: 0.3rem;
                    font-size: 0.9rem;
                    opacity: 0.9;
                }
            `;
            document.head.appendChild(style);
        }
        
        // ドキュメントに追加
        document.body.appendChild(toast);
        
        // 自動削除
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideInRight 0.3s ease-out reverse';
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);
    }
}

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
    window.salaryPredictor = new SalaryPredictor();
});

// パフォーマンス最適化: Intersection Observer を使用して表示領域に入った時のアニメーション
const observeElements = () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    // 観察対象の要素を追加
    document.querySelectorAll('.country-card, .info-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
        observer.observe(el);
    });
};

// ページ読み込み完了後に実行
window.addEventListener('load', observeElements);

// エラーハンドリング
window.addEventListener('error', (event) => {
    console.error('グローバルエラー:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未処理のPromise拒否:', event.reason);
    event.preventDefault();
});