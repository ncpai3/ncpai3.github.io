/* === TỆP: system1.js === */
/* Toàn bộ logic cho Hệ Thống 1 */

const System1 = (() => {
    
    // --- STATE TẠM THỜI (CHO TÍNH TOÁN) ---
    // Lưu trữ các dự đoán cho ván hiện tại, trước khi 'result' được nhập
    let tempState = {
        currentPrediction: null,
        originalSystemPrediction: null,
        currentFinalPrediction: null,
        currentChotPredictionForLog: null,
    };

    // --- CONSTANTS (Của riêng HT 1) ---
    const CHOT_SOURCES = ['follow', 'against', '90-100', '80-90', '70-80', '60-70', '50-60'];
    const CONFIDENCE_RANGES = [
        { key: '50-60', min: 50, max: 60 }, { key: '60-70', min: 60, max: 70 },
        { key: '70-80', min: 70, max: 80 }, { key: '80-90', min: 80, max: 90 },
        { key: '90-100', min: 90, max: 100.1 } // Use 100.1 to include 100
    ];

    // --- CORE LOGIC: PATTERN MATCHER (HT 1) ---
    // (Sử dụng các hằng số min/max của HT 1)
    class PatternMatcher {
        constructor() {
            this.MIN_HISTORY_FOR_ANALYSIS = 10;
            this.MIN_PATTERN_LENGTH = 10; // <<<< HT 1
            this.MAX_PATTERN_LENGTH = 20; // <<<< HT 1
            this.MIN_CERTAIN_OCCURRENCES = 5;
        }
        calculateSimilarity(arr1, arr2) {
            if (arr1.length !== arr2.length || arr1.length === 0) return 0;
            const matches = arr1.filter((item, index) => item === arr2[index]).length;
            return matches / arr1.length;
        }
        findPatternOccurrences(pattern, allHistory) {
            const occurrences = [];
            const reversedPattern = [...pattern].reverse();
            for (const session of allHistory) {
                const sessionHistory = session.history || []; // Dùng history chung
                if (sessionHistory.length < pattern.length + 1) continue;
                for (let i = 0; i <= sessionHistory.length - pattern.length - 1; i++) {
                    const segment = sessionHistory.slice(i, i + pattern.length);
                    const nextResult = sessionHistory[i + pattern.length];
                    const similarity = this.calculateSimilarity(pattern, segment);
                    if (similarity >= 0.9) occurrences.push({ type: 'similar', next: nextResult, similarity });
                    const reverseSimilarity = this.calculateSimilarity(reversedPattern, segment);
                    if (reverseSimilarity >= 0.9) occurrences.push({ type: 'reversed', next: nextResult, similarity: reverseSimilarity });
                }
            }
            return occurrences;
        }
        getPredictionForPattern(pattern, allHistoricalSessions) {
            const occurrences = this.findPatternOccurrences(pattern, allHistoricalSessions);
            if (occurrences.length === 0) return { prediction: null };
            const votes = { P: 0, B: 0 };
            occurrences.forEach(match => { if (votes[match.next] !== undefined) votes[match.next] += match.similarity; });
            const totalVotes = votes.P + votes.B;
            if (totalVotes === 0) return { prediction: null };
            const predictedWinner = votes.P > votes.B ? 'P' : 'B';
            const confidence = (Math.max(votes.P, votes.B) / totalVotes) * 100;
            return { prediction: predictedWinner, confidence, votes, totalOccurrences: occurrences.length };
        }
        findCertainPrediction(currentHistory, allHistoricalSessions) {
            for (let len = Math.min(this.MAX_PATTERN_LENGTH, currentHistory.length); len >= this.MIN_PATTERN_LENGTH; len--) {
                const pattern = currentHistory.slice(-len);
                const patternString = pattern.join('');
                const occurrences = [];
                for (const session of allHistoricalSessions) {
                    const sessionHistory = session.history || [];
                    if (sessionHistory.length < pattern.length + 1) continue;
                    for (let i = 0; i <= sessionHistory.length - pattern.length - 1; i++) {
                        const segment = sessionHistory.slice(i, i + pattern.length);
                        if (segment.join('') === patternString) {
                            occurrences.push(sessionHistory[i + pattern.length]);
                        }
                    }
                }
                if (occurrences.length >= this.MIN_CERTAIN_OCCURRENCES && new Set(occurrences).size === 1) {
                    return {
                        prediction: occurrences[0],
                        recommendation: 'TAY CHẮC CHẮN',
                        analysisText: `Tìm thấy ${occurrences.length} lần xuất hiện chính xác của hình cầu này trong lịch sử.\nTất cả đều cho kết quả tiếp theo là: ${occurrences[0]}`,
                        confidence: 100,
                        isCertain: true
                    };
                }
            }
            return null;
        }
        analyzeCurrentStreak(currentHistory) {
            if (currentHistory.length < 2) return { type: 'none', length: currentHistory.length };
            const last = currentHistory[currentHistory.length - 1];
            if (last === currentHistory[currentHistory.length - 2]) {
                let length = 0;
                for (let i = currentHistory.length - 1; i >= 0; i--) {
                    if (currentHistory[i] === last) length++; else break;
                }
                return { type: 'bệt', length, value: last };
            } else {
                let length = 0;
                for (let i = currentHistory.length - 1; i >= 1; i--) {
                    if (currentHistory[i] !== currentHistory[i-1]) length++; else break;
                }
                return { type: '1-1', length: length + 1 };
            }
        }
        getPrediction(currentHistory, allHistoricalSessions, { optimalLength = null, lengthPerformance = {} } = {}) {
            if (currentHistory.length < this.MIN_HISTORY_FOR_ANALYSIS) {
                return { prediction: null, analysisText: `Cần ít nhất ${this.MIN_HISTORY_FOR_ANALYSIS} kết quả...`, confidence: 0, isCertain: false };
            }
            if (optimalLength && currentHistory.length >= optimalLength) {
                const pattern = currentHistory.slice(-optimalLength);
                const result = this.getPredictionForPattern(pattern, allHistoricalSessions);
                if (result.prediction) {
                    const perf = lengthPerformance[optimalLength] || { wins: 0, total: 0 };
                    if (perf.wins > perf.total) { perf.wins = perf.total; }
                    const rate = perf.total > 0 ? (perf.wins / perf.total * 100).toFixed(1) : 'N/A';
                    return {
                        prediction: result.prediction, recommendation: 'THEO CHIỀU DÀI TỐI ƯU',
                        analysisText: `Sử dụng chiều dài cầu tối ưu: ${optimalLength} ván.\n(Tỷ lệ thắng của chiều dài này: ${rate}% - ${perf.wins}/${perf.total})\n\nLịch sử cho thấy:\n- PLAYER: ${result.votes.P.toFixed(1)} điểm\n- BANKER: ${result.votes.B.toFixed(1)} điểm`,
                        confidence: result.confidence, isCertain: false
                    };
                }
            }
            const certainPrediction = this.findCertainPrediction(currentHistory, allHistoricalSessions);
            if (certainPrediction) return certainPrediction;
            const allMatches = [];
            for (let len = Math.min(this.MAX_PATTERN_LENGTH, currentHistory.length); len >= this.MIN_PATTERN_LENGTH; len--) {
                const pattern = currentHistory.slice(-len);
                const occurrences = this.findPatternOccurrences(pattern, allHistoricalSessions);
                if (occurrences.length > 0) {
                    allMatches.push(...occurrences);
                    break;
                }
            }
            if (allMatches.length === 0) return { prediction: null, analysisText: 'Không tìm thấy hình cầu tương tự.', confidence: 0, isCertain: false };
            const votes = { P: 0, B: 0 };
            allMatches.forEach(match => { if (votes[match.next] !== undefined) votes[match.next] += match.similarity; });
            const totalVotes = votes.P + votes.B;
            if (totalVotes === 0) return { prediction: null, analysisText: 'Không tìm thấy hình cầu tương tự.', confidence: 0, isCertain: false };
            const predictedWinner = votes.P > votes.B ? 'P' : 'B';
            const maxConfidence = (Math.max(votes.P, votes.B) / totalVotes) * 100;
            const analysisTextPrefix = `Tìm thấy ${allMatches.length} hình cầu tương tự. Lịch sử cho thấy:\n- PLAYER: ${votes.P.toFixed(1)} điểm\n- BANKER: ${votes.B.toFixed(1)} điểm`;
            const streakInfo = this.analyzeCurrentStreak(currentHistory);
            let recommendation = 'THEO PHÂN TÍCH LỊCH SỬ';
            if (streakInfo.type === 'bệt') recommendation = predictedWinner === streakInfo.value ? `THEO BỆT (${streakInfo.value}x${streakInfo.length})` : `BẺ CẦU BỆT (${streakInfo.value}x${streakInfo.length})`;
            else if (streakInfo.type === '1-1') recommendation = predictedWinner !== currentHistory[currentHistory.length - 1] ?
                `THEO CẦU 1-1 (Dài ${streakInfo.length})` : `BẺ CẦU 1-1 (Dài ${streakInfo.length})`;
            return { prediction: predictedWinner, recommendation, analysisText: `${analysisTextPrefix}\n\n🏆 Độ tin cậy: ${maxConfidence.toFixed(1)}%`, confidence: maxConfidence, isCertain: false };
        }
    }
    
    // Khởi tạo một thực thể (instance) của matcher cho HT 1
    const matcher = new PatternMatcher();

    // --- STATS CALCULATION ---
    function getPredictionStats(predictions) {
        const total = predictions.length;
        if (total === 0) return { rate: 0, correct: 0, total: 0 };
        const correct = predictions.filter(p => p.predicted === p.actual).length;
        return { rate: (correct / total) * 100, correct, total };
    }

    function calculateConfidenceRangeStats(predictions) {
        const ranges = CONFIDENCE_RANGES.map(r => ({ ...r, total: 0, wins: 0, rate: -1 }));
        ranges.forEach(range => {
            const predictionsForRange = predictions.filter(p => p.confidence >= range.min && (p.confidence < range.max));
            range.total = predictionsForRange.length;
            range.wins = predictionsForRange.filter(p => p.predicted === p.actual).length;
            range.rate = range.total > 0 ? ((range.wins / range.total) * 100) : -1;
        });
        return ranges;
    }

    // Lấy chuỗi W/L cho các khoảng tin cậy (Dùng cho Chốt)
    function getConfidenceSequenceData(allSessions) {
        const sequenceData = {};
        CONFIDENCE_RANGES.forEach(r => { sequenceData[r.key] = {}; });
        
        for (const session of allSessions) {
            const sessionId = session.name; // Dùng 1 ID nhất quán, ở đây ví dụ là name
            const sessionPredictions = session.sys1.predictions || [];
            if (sessionPredictions.length === 0) continue;

            const sessionSequences = {};
            CONFIDENCE_RANGES.forEach(r => { sessionSequences[r.key] = []; });
            
            sessionPredictions.forEach(p => {
                const result = (p.predicted === p.actual) ? 'W' : 'L';
                const foundRange = CONFIDENCE_RANGES.find(r => p.confidence >= r.min && p.confidence < r.max);
                if (foundRange) {
                    sessionSequences[foundRange.key].push(result);
                }
            });
            for (const key in sessionSequences) {
                if (sessionSequences[key].length > 0) {
                    sequenceData[key][sessionId] = sessionSequences[key].join('');
                }
            }
        }
        return sequenceData;
    }

    // --- SELF-VERDICT LOGIC (Dùng cho Chốt) ---
    function getCurrentStreak(sequence) {
        if (!sequence || sequence.length === 0) return { type: null, length: 0 };
        const lastChar = sequence.slice(-1);
        let length = 0;
        for (let i = sequence.length - 1; i >= 0; i--) {
            if (sequence[i] === lastChar) { length++; } else { break; }
        }
        return { type: lastChar, length };
    }

    function calculateStreakStats(sequencesObject) {
        let maxW = 0, maxL = 0;
        const allSequences = Object.values(sequencesObject).join('');
        if (!allSequences) return { maxW: 0, maxL: 0 };
        const winStreaks = allSequences.match(/W+/g) || [];
        if (winStreaks.length > 0) { maxW = Math.max(...winStreaks.map(s => s.length)); }
        const lossStreaks = allSequences.match(/L+/g) || [];
        if (lossStreaks.length > 0) { maxL = Math.max(...lossStreaks.map(s => s.length)); }
        return { maxW, maxL };
    }

    function getFinalVerdict(context) {
        const { prediction, confidence, sequenceData, currentSessionId } = context;
        if (!prediction) {
            return { verdict: 'neutral', explanation: 'Chưa có đủ dữ liệu để đưa ra phán quyết.' };
        }
        const foundRange = CONFIDENCE_RANGES.find(r => confidence >= r.min && confidence < r.max);
        if (!foundRange) {
            return { verdict: 'neutral', explanation: 'Phán đoán không thuộc khoảng tin cậy nào.' };
        }
        const rangeKey = foundRange.key;
        // Dùng currentSessionId (là name) để tìm chuỗi hiện tại
        const historicalSequences = { ...sequenceData[rangeKey] };
        const currentSequenceStr = historicalSequences[currentSessionId] || "";
        delete historicalSequences[currentSessionId];
        
        // Tier 1: Longest pattern
        const maxLen = Math.min(currentSequenceStr.length, 5);
        for (let len = maxLen; len >= 2; len--) {
            const patternToSearch = currentSequenceStr.slice(-len);
            let wins = 0, losses = 0;
            for (const sessionId in historicalSequences) {
                const history = historicalSequences[sessionId];
                let i = -1;
                while ((i = history.indexOf(patternToSearch, i + 1)) !== -1) {
                    const nextCharIndex = i + patternToSearch.length;
                    if (nextCharIndex < history.length) {
                        if (history[nextCharIndex] === 'W') wins++; else losses++;
                    }
                }
            }
            if (wins + losses >= 2) {
                const patternText = patternToSearch.replace(/W/g, 'Thắng-').replace(/L/g, 'Thua-').slice(0, -1);
                if (wins > losses) return { verdict: 'follow', explanation: `Nên theo. Quy luật dài ${len} ván...` };
                if (losses > wins) return { verdict: 'against', explanation: `Nên đi ngược lại. Quy luật dài ${len} ván...` };
            }
        }
        
        // Tier 2: Max Streak
        const currentStreak = getCurrentStreak(currentSequenceStr);
        const streakStats = calculateStreakStats(historicalSequences);
        if (currentStreak.type === 'W' && streakStats.maxW > 0 && currentStreak.length >= streakStats.maxW) {
            return { verdict: 'against', explanation: `Nên đi ngược lại. Chuỗi Thắng (${currentStreak.length}) đã bằng/vượt max (${streakStats.maxW}).` };
        }
        if (currentStreak.type === 'L' && streakStats.maxL > 0 && currentStreak.length >= streakStats.maxL) {
            return { verdict: 'follow', explanation: `Nên theo. Chuỗi Thua (${currentStreak.length}) đã bằng/vượt max (${streakStats.maxL}).` };
        }
        
        // Tier 3: Absolute pattern
        const absolutePatternLength = Math.min(currentSequenceStr.length, 3);
        if (absolutePatternLength >= 2) {
            const patternToSearch = currentSequenceStr.slice(-absolutePatternLength);
            let crossWins = 0, crossLosses = 0;
            const MIN_ABSOLUTE_OCCURRENCES = 4;
            for (const key in sequenceData) {
                const otherRangeSequences = sequenceData[key];
                for (const sessionId in otherRangeSequences) {
                    if (sessionId === currentSessionId) continue;
                    const history = otherRangeSequences[sessionId];
                    let i = -1;
                    while ((i = history.indexOf(patternToSearch, i + 1)) !== -1) {
                        const nextCharIndex = i + patternToSearch.length;
                        if (nextCharIndex < history.length) {
                            if (history[nextCharIndex] === 'W') crossWins++; else crossLosses++;
                        }
                    }
                }
            }
            const patternText = patternToSearch.replace(/W/g, 'Thắng-').replace(/L/g, 'Thua-').slice(0, -1);
            if (crossWins + crossLosses >= MIN_ABSOLUTE_OCCURRENCES) {
                if (crossWins === 0) return { verdict: 'against', explanation: `Quy luật tuyệt đối (${patternText} -> Thua) toàn lịch sử.` };
                if (crossLosses === 0) return { verdict: 'follow', explanation: `Quy luật tuyệt đối (${patternText} -> Thắng) toàn lịch sử.` };
            }
        }
        return { verdict: 'neutral', explanation: 'Không tìm thấy quy luật biểu đồ rõ ràng.' };
    }
    
    // --- CHỐT ANALYSIS LOGIC (HT 1) ---
    function getChotAnalysisData(allSessions) {
        const sequencesBySource = CHOT_SOURCES.reduce((acc, key) => { acc[key] = {}; return acc; }, {});
        
        for (const session of allSessions) {
            const sessionId = session.name; // Dùng name làm ID
            let followSeq = '', againstSeq = '';
            
            (session.sys1.verdictPredictions || []).forEach(p => {
                const result = p.predicted === p.actual ? 'W' : 'L';
                if (p.verdict === 'follow') followSeq += result;
                else if (p.verdict === 'against') againstSeq += result;
            });
            sequencesBySource.follow[sessionId] = followSeq;
            sequencesBySource.against[sessionId] = againstSeq;

            CONFIDENCE_RANGES.forEach(r => {
                if (!sequencesBySource[r.key]) sequencesBySource[r.key] = {};
                sequencesBySource[r.key][sessionId] = "";
            });

            (session.sys1.predictions || []).forEach(p => {
                const result = (p.predicted === p.actual) ? 'W' : 'L';
                const foundRange = CONFIDENCE_RANGES.find(r => p.confidence >= r.min && p.confidence < r.max);
                if (foundRange) {
                    sequencesBySource[foundRange.key][sessionId] += result;
                }
            });
        }
        return sequencesBySource;
    }

    function findNextOutcomeInHistory(pattern, historicalSequences) {
        if (!pattern || pattern.length < 1) return { W: 0, L: 0, total: 0 };
        let W = 0, L = 0;
        for (const sessionId in historicalSequences) {
            const history = historicalSequences[sessionId];
            if (!history || history.length < pattern.length + 1) continue;
            let i = -1;
            while ((i = history.indexOf(pattern, i + 1)) !== -1) {
                const nextCharIndex = i + pattern.length;
                const prevCharDifferent = (i === 0 || history[i - 1] !== pattern[pattern.length - 1]);
                if (prevCharDifferent && nextCharIndex < history.length) {
                    if (history[nextCharIndex] === 'W') W++;
                    else L++;
                }
            }
        }
        return { W, L, total: W + L };
    }

    function findBestChotPatternLength(currentSequence, historicalSequences, minLen = 3, maxLen = 20, minOccurrences = 2) {
        const possibleResults = [];
        for (let len = Math.min(maxLen, currentSequence.length); len >= minLen; len--) {
            const pattern = currentSequence.slice(-len);
            if (!pattern) continue;
            const stats = findNextOutcomeInHistory(pattern, historicalSequences);
            if (stats.total >= minOccurrences) {
                const rateW = stats.total > 0 ? stats.W / stats.total : 0;
                possibleResults.push({ length: len, stats: stats, rate: rateW });
            }
        }
        if (possibleResults.length === 0) return null;
        possibleResults.sort((a, b) => {
            const deviationA = Math.abs(a.rate - 0.5);
            const deviationB = Math.abs(b.rate - 0.5);
            if (deviationA !== deviationB) return deviationB - deviationA;
            return b.stats.total - a.stats.total;
        });
        return possibleResults[0];
    }

    function analyzeMaxStreak(currentSequence, historicalSequences) {
        const { type: currentType, length: currentLength } = getCurrentStreak(currentSequence);
        if (!currentType) return null;
        const { maxW, maxL } = calculateStreakStats(historicalSequences);
        if (currentType === 'W' && maxW > 0 && currentLength >= maxW) {
            return { predictionType: 'MAX_STREAK', predictedWL: 'L', explanation: `Max W (${maxW})`, stats: { W: 0, L: 999, total: 999 } };
        }
        if (currentType === 'L' && maxL > 0 && currentLength >= maxL) {
            return { predictionType: 'MAX_STREAK', predictedWL: 'W', explanation: `Max L (${maxL})`, stats: { W: 999, L: 0, total: 999 } };
        }
        return null;
    }

    function getChotPrediction(currentSequence, historicalSequences, sourceKey, session) {
        const MIN_PATTERN_LEN = 3;
        const MAX_PATTERN_LEN = 20;
        const MIN_PATTERN_OCCURRENCES = 2;
        
        if (!session.sys1) return { predictionType: 'NOT_ENOUGH_WL' }; // An toàn
        const optimalLength = session.sys1.chotOptimalLengths ? session.sys1.chotOptimalLengths[sourceKey] : null;

        if (optimalLength && currentSequence.length >= optimalLength) {
            const pattern = currentSequence.slice(-optimalLength);
            const stats = findNextOutcomeInHistory(pattern, historicalSequences);
            if (stats.total > 0) {
                if (stats.W > stats.L) return { predictionType: 'OPTIMAL', predictedWL: 'W', stats: stats, optimalLength: optimalLength };
                if (stats.L > stats.W) return { predictionType: 'OPTIMAL', predictedWL: 'L', stats: stats, optimalLength: optimalLength };
            }
        }

        const maxStreakAnalysis = analyzeMaxStreak(currentSequence, historicalSequences);
        if (maxStreakAnalysis) return maxStreakAnalysis;

        if (currentSequence.length < MIN_PATTERN_LEN) return { predictionType: 'NOT_ENOUGH_WL' };
        
        const bestPatternInfo = findBestChotPatternLength(currentSequence, historicalSequences, MIN_PATTERN_LEN, MAX_PATTERN_LEN, MIN_PATTERN_OCCURRENCES);
        if (!bestPatternInfo) return { predictionType: 'NO_HISTORY_PATTERN' };
        
        const { stats, length } = bestPatternInfo;
        if (stats.W > stats.L) return { predictionType: 'FALLBACK', predictedWL: 'W', stats: stats, optimalLength: length };
        if (stats.L > stats.W) return { predictionType: 'FALLBACK', predictedWL: 'L', stats: stats, optimalLength: length };
        return { predictionType: 'BALANCED', stats: stats, optimalLength: length };
    }
    
    // --- UI UPDATE FUNCTIONS (Cho HT 1) ---
    // (Các hàm này chỉ cập nhật DOM, logic đã được tính toán)
    
    function updateAccuracyUI(session) {
        const predictions = session.sys1.predictions || [];
        const stats = getPredictionStats(predictions);
        // SỬA ID: Thêm "-1"
        document.getElementById('accuracyRate-1').textContent = `${stats.rate.toFixed(1)}%`;
        document.getElementById('correctPredictions-1').textContent = stats.correct;
        document.getElementById('totalPredictions-1').textContent = stats.total;
    }

    function updateGlobalAccuracyUI(allSessions) {
        const allPredictions = allSessions.flatMap(s => s.sys1.predictions || []);
        const stats = getPredictionStats(allPredictions);
        // SỬA ID: Thêm "-1"
        document.getElementById('globalAccuracyRate-1').textContent = `${stats.rate.toFixed(1)}%`;
        document.getElementById('globalCorrectPredictions-1').textContent = stats.correct;
        document.getElementById('globalTotalPredictions-1').textContent = stats.total;
    }

    // Tính toán và cập nhật Phán Quyết HT
    function updateAnalysisUI(session, allSessions) {
        const { prediction, recommendation, analysisText, confidence, isCertain } = matcher.getPrediction(
            session.history, // Dùng history chung
            allSessions, 
            {
                optimalLength: session.sys1.optimalLength,
                lengthPerformance: session.sys1.lengthPerformance
            }
        );

        // Lưu vào state tạm thời
        tempState.currentPrediction = { prediction, confidence };
        tempState.originalSystemPrediction = prediction;
        
        const confidenceSequenceData = getConfidenceSequenceData(allSessions);

        const verdictContext = {
            prediction, confidence,
            sequenceData: confidenceSequenceData,
            currentSessionId: session.name // Dùng name làm ID
        };
        const finalVerdict = getFinalVerdict(verdictContext);

        let finalPredictionForDisplay = prediction;
        if (finalVerdict.verdict === 'against' && !isCertain) {
            finalPredictionForDisplay = prediction === 'P' ? 'B' : 'P';
        }
        
        // Lưu vào state tạm thời
        tempState.currentFinalPrediction = { verdict: finalVerdict.verdict, prediction: finalPredictionForDisplay };

        let verdictHTML = `<div class="mt-3 p-3 text-center bg-gray-800 rounded-lg text-sm font-semibold ${
            finalVerdict.verdict === 'follow' || isCertain ? 'text-green-300' :
            finalVerdict.verdict === 'against' ? 'text-red-300' : 'text-yellow-300'
        }"><strong>Phán Quyết HT 1:</strong> ${isCertain ?
            'Tay chắc chắn, luôn ưu tiên theo hệ thống.' : finalVerdict.explanation}</div>`;

        let recommendationText = recommendation;
        if(finalVerdict.verdict === 'against' && !isCertain) {
            recommendationText = 'ĐI NGƯỢC HỆ THỐNG';
        }

        // SỬA ID: Thêm "-1"
        const analysisResultDiv = document.getElementById('analysisResult-1');
        const analysisCard = document.getElementById('analysis-card-1');
        
        analysisCard.classList.remove('card-glow-p', 'card-glow-b', 'card-glow-certain');
        
        let optimalLengthDisplay = session.sys1.optimalLength ? `<div class="mb-4 p-3 bg-gray-900 rounded-lg text-center text-cyan-300 text-sm"><span class="font-semibold">Chiều dài tối ưu:</span><span class="text-lg font-bold ml-2">${session.sys1.optimalLength}</span></div>` : '';
        
        if (prediction) {
            let predictionBlockHTML = `
            <div class="text-center bg-gray-900 py-6 rounded-lg border-2 ${finalPredictionForDisplay === 'P' ? 'border-blue-500' : 'border-red-500'}">
                <p class="text-lg text-gray-400 mb-2">Đề xuất theo hệ thống 1:</p>
                <p class="text-3xl font-extrabold ${finalPredictionForDisplay === 'P' ? 'text-blue-400' : 'text-red-400'}">${recommendationText}</p>
                <p class="text-4xl font-bold mt-2">${finalPredictionForDisplay === 'P' ? '👤 PLAYER' : '🏦 BANKER'}</p>
                ${verdictHTML}
            </div>
            <div class="bg-gray-700 p-4 rounded-lg mt-4">
                <p class="font-semibold text-gray-300">Phân tích ban đầu (HT 1):</p>
                <p class="text-gray-400 whitespace-pre-wrap text-sm">${analysisText}</p>
            </div>`;

            if (isCertain) {
                predictionBlockHTML = `
                <div class="text-center bg-yellow-800 bg-opacity-50 py-6 rounded-lg border-2 border-yellow-400">
                    <p class="text-lg text-yellow-300 mb-2 animate-pulse">Đề Xuất Chắc Chắn (Lịch sử):</p>
                    <p class="text-3xl font-extrabold text-yellow-300">${recommendation}</p>
                    <p class="text-4xl font-bold mt-2">${prediction === 'P' ? '👤 PLAYER' : '🏦 BANKER'}</p>
                    ${verdictHTML}
                </div>
                <div class="bg-gray-700 p-4 rounded-lg mt-4">
                    <p class="font-semibold text-gray-300">Phân tích ban đầu (HT 1):</p>
                    <p class="text-gray-400 whitespace-pre-wrap text-sm">${analysisText}</p>
                </div>`;
                analysisCard.classList.add('card-glow-certain');
            } else {
                analysisCard.classList.add(finalPredictionForDisplay === 'P' ? 'card-glow-p' : 'card-glow-b');
            }
            analysisResultDiv.innerHTML = optimalLengthDisplay + predictionBlockHTML;
        } else {
            analysisResultDiv.innerHTML = `${optimalLengthDisplay}<p class="text-gray-400 text-center py-8 whitespace-pre-wrap">${analysisText}</p>`;
        }
    }

    // 4. Bỏ 2 hàm updateConfidenceStatsUI và updateVerdictStatsUI (theo yêu cầu)

    // Tạo HTML cho hàng Chốt (riêng của HT 1)
    function getChotRowHTML(name, currentSequence, analysisResult, isActive, finalPBprediction) {
        let wlPredictionText = '-';
        let wlPredictionColor = 'text-gray-500';
        let analysisTypeDisplay = '-';
        let predictedWL = analysisResult.predictedWL;

        if (predictedWL) {
            const { stats } = analysisResult;
            const rate = stats.total > 0 ? (predictedWL === 'W' ? stats.W / stats.total : stats.L / stats.total) * 100 : 0;
            wlPredictionText = `-> ${predictedWL} (${rate.toFixed(0)}%)`;
            wlPredictionColor = predictedWL === 'W' ? 'text-green-400' : 'text-red-400';
        } else if (analysisResult.predictionType === 'BALANCED') {
            wlPredictionText = 'Cân bằng';
            wlPredictionColor = 'text-yellow-400';
        } else if (analysisResult.predictionType === 'NOT_ENOUGH_SAMPLES') {
            wlPredictionText = 'Ít mẫu';
        } else if (analysisResult.predictionType === 'NO_HISTORY_PATTERN') {
            wlPredictionText = 'Ko mẫu LS';
            wlPredictionColor = 'text-gray-600';
        } else if (analysisResult.predictionType === 'NOT_ENOUGH_WL') {
             wlPredictionText = 'Chờ W/L';
             wlPredictionColor = 'text-gray-600';
        }

        if (analysisResult.predictionType === 'OPTIMAL') {
            analysisTypeDisplay = `Optimal ${analysisResult.optimalLength}`;
        } else if (analysisResult.predictionType === 'MAX_STREAK') {
            analysisTypeDisplay = analysisResult.explanation;
            wlPredictionText = `-> ${predictedWL} (Max Streak)`;
        } else if (analysisResult.predictionType === 'FALLBACK') {
            analysisTypeDisplay = `Fallback ${analysisResult.optimalLength}`;
        } else if (analysisResult.predictionType === 'BALANCED') {
            analysisTypeDisplay = `FB ${analysisResult.optimalLength} (Cân)`;
        } else if (analysisResult.predictionType === 'NOT_ENOUGH_SAMPLES') {
            analysisTypeDisplay = `FB ${analysisResult.optimalLength} (Ít mẫu)`;
        } else if (analysisResult.predictionType === 'NO_HISTORY_PATTERN') {
            analysisTypeDisplay = 'Ko mẫu LS';
        } else if (analysisResult.predictionType === 'NOT_ENOUGH_WL') {
            analysisTypeDisplay = 'Chờ W/L';
        }

        let pbIndicator = '';
        if (isActive && finalPBprediction) {
            const pbColor = finalPBprediction === 'P' ? 'text-blue-400' : 'text-red-400';
            pbIndicator = `<span class="font-bold ${pbColor} ml-1">[${finalPBprediction}]</span>`;
        }
        
        const activeClass = isActive ? 'bg-gray-700 bg-opacity-60 ring-1 ring-purple-500' : 'bg-gray-900';
        const displayedHistory = currentSequence.slice(-30);
        let individualBarsHTML = `<div class="flex items-end justify-center gap-px h-5 my-auto overflow-hidden" title="Diễn biến W/L gần đây (Tối đa 30)">`;
        if (displayedHistory.length > 0) {
            for (const result of displayedHistory) {
                const isWin = result === 'W';
                const barClass = isWin ? 'bg-green-500 h-5' : 'bg-red-500 h-2';
                const title = `Kết quả: ${isWin ? 'THẮNG' : 'THUA'}`;
                individualBarsHTML += `<div class="flex-shrink-0 w-1 ${barClass} rounded-t-sm" title="${title}"></div>`;
            }
        } else {
            individualBarsHTML += `<div class="w-full text-center"><span class="text-gray-600 text-xs">Chưa có</span></div>`;
        }
        individualBarsHTML += '</div>';
        
        return `
        <div class="grid grid-cols-12 gap-2 items-center text-xs mb-1 p-1.5 ${activeClass} rounded-lg transition-colors duration-300">
            <div class="col-span-2 font-semibold ${isActive ? 'text-purple-300' : 'text-gray-300'} truncate" title="${name}">${name}</div>
            <div class="col-span-3 text-center text-gray-400" title="Loại phân tích (Optimal / Max / Fallback)">${analysisTypeDisplay}</div>
            <div class="col-span-3">${individualBarsHTML}</div>
            <div class="col-span-4 text-right font-bold ${wlPredictionColor} truncate" title="${wlPredictionText}">
                ${wlPredictionText}
                ${pbIndicator}
            </div>
        </div>`;
    }

    // Tính toán và cập nhật Chốt Phán Quyết (HT 1)
    function updateChotAnalysisUI(session, allSessions) {
        const MAX_BARS_TO_SHOW = 50;
        // SỬA ID: Thêm "-1"
        const finalChotResultDiv = document.getElementById('finalChotResult-1');
        const finalChotResultText = document.getElementById('finalChotResultText-1');
        const chotAnalysisDetailsDiv = document.getElementById('chotAnalysisDetails-1');
        const chotHistoryChartDiv = document.getElementById('chotHistoryChart-1');
        const chotAccuracyStatsSpan = document.getElementById('chotAccuracyStats-1');

        if (!finalChotResultDiv || !chotAnalysisDetailsDiv || !chotHistoryChartDiv || !chotAccuracyStatsSpan || !finalChotResultText) return;

        const activeSourcesKeys = new Set();
        const originalSystemPB = tempState.originalSystemPrediction;
        const currentConfidence = tempState.currentPrediction?.confidence;
        const finalVerdictInfo = tempState.currentFinalPrediction;
        
        tempState.currentChotPredictionForLog = null; // Reset
        let analysisRowsHTML = '';
        const finalVotesPB = { P: 0, B: 0 };

        if (originalSystemPB && finalVerdictInfo !== null) {
            if (finalVerdictInfo.verdict === 'follow') activeSourcesKeys.add('follow');
            else if (finalVerdictInfo.verdict === 'against') activeSourcesKeys.add('against');
            
            const activeConfidenceRange = CONFIDENCE_RANGES.find(r => currentConfidence >= r.min && currentConfidence < r.max);
            if (activeConfidenceRange) activeSourcesKeys.add(activeConfidenceRange.key);
            
            const allSequences = getChotAnalysisData(allSessions);
            const currentSessionId = session.name; // Dùng name
            
            const sources = CHOT_SOURCES.map(key => ({
                key: key,
                name: key === 'follow' ? 'Theo HT' : key === 'against' ? 'Ngược HT' : `${key.replace('-', ' - ')}%`
            }));
            
            for (const source of sources) {
                const isActive = activeSourcesKeys.has(source.key);
                const currentSequence = allSequences[source.key]?.[currentSessionId] || "";
                const historicalData = { ...allSequences[source.key] };
                if(historicalData) delete historicalData[currentSessionId];
                
                const analysisResult = getChotPrediction(currentSequence, historicalData, source.key, session);
                
                const predictedWL = analysisResult.predictedWL || null;
                let finalPBprediction = null;
                let voteFor = null;

                if (isActive && predictedWL) {
                    if (source.key === 'against') {
                        voteFor = (predictedWL === 'W') ? (originalSystemPB === 'P' ? 'B' : 'P') : originalSystemPB;
                    } else {
                        voteFor = (predictedWL === 'W') ? originalSystemPB : (originalSystemPB === 'P' ? 'B' : 'P');
                    }
                    finalVotesPB[voteFor]++;
                    finalPBprediction = voteFor;
                }
                analysisRowsHTML += getChotRowHTML(source.name, currentSequence, analysisResult, isActive, finalPBprediction);
            }
            chotAnalysisDetailsDiv.innerHTML = analysisRowsHTML || '<p class="text-gray-500 text-center py-4">Chưa đủ dữ liệu W/L...</p>';
        } else {
            chotAnalysisDetailsDiv.innerHTML = '<p class="text-gray-500 text-center py-4">Chờ tín hiệu từ Phán Quyết HT 1...</p>';
        }

        let finalChotPredictionTextContent = '... Chờ tín hiệu ...';
        let finalChotPredictionColor = 'text-gray-400';
        let finalChotBorderColor = 'border-purple-500';
        let finalChotPB = null;
        const totalVotes = finalVotesPB.P + finalVotesPB.B;

        if (totalVotes > 0) {
            if (finalVotesPB.P > finalVotesPB.B) {
                finalChotPB = 'P';
                finalChotPredictionTextContent = `PLAYER ( ${finalVotesPB.P} / ${totalVotes} phiếu )`;
                finalChotPredictionColor = 'text-blue-400';
                finalChotBorderColor = 'border-blue-500';
            } else if (finalVotesPB.B > finalVotesPB.P) {
                finalChotPB = 'B';
                finalChotPredictionTextContent = `BANKER ( ${finalVotesPB.B} / ${totalVotes} phiếu )`;
                finalChotPredictionColor = 'text-red-400';
                finalChotBorderColor = 'border-red-500';
            } else {
                finalChotPredictionTextContent = `HÒA PHIẾU (${finalVotesPB.P} - ${finalVotesPB.B})`;
                finalChotPredictionColor = 'text-yellow-400';
                finalChotBorderColor = 'border-yellow-500';
            }
        } else if (originalSystemPB && finalVerdictInfo !== null) {
            finalChotPredictionTextContent = 'Không đủ tín hiệu bỏ phiếu';
        }
        
        // Lưu Chốt vào state tạm thời
        tempState.currentChotPredictionForLog = {
            prediction: finalChotPB,
            source: 'CHOT_VOTE'
        };

        finalChotResultDiv.className = `text-center bg-gray-900 py-4 rounded-lg border-2 ${finalChotBorderColor} mb-4 transition-all duration-300`;
        finalChotResultText.textContent = finalChotPredictionTextContent;
        finalChotResultText.className = `text-2xl font-extrabold ${finalChotPredictionColor}`;

        // Vẽ biểu đồ lịch sử Chốt
        const chotHistory = session.sys1.chotPredictions || [];
        let correctChot = 0;
        const totalChot = chotHistory.length;
        let barsHTML = '';
        const historyToShow = chotHistory.slice(-MAX_BARS_TO_SHOW);
        
        if (historyToShow.length > 0) {
            historyToShow.forEach(p => {
                if (p && p.predicted !== undefined && p.actual !== undefined) {
                    const isCorrect = p.predicted === p.actual;
                    if (isCorrect) correctChot++;
                    const barClass = isCorrect ? 'history-bar-correct' : 'history-bar-incorrect';
                    const title = `Chốt: ${p.predicted}, Ra: ${p.actual} -> ${isCorrect ? 'Đúng' : 'Sai'}`;
                    barsHTML += `<div class="history-bar ${barClass}" title="${title}"></div>`;
                }
            });
            chotHistoryChartDiv.innerHTML = barsHTML;
        } else {
            chotHistoryChartDiv.innerHTML = '<p class="text-gray-600 text-xs text-center w-full">Chưa có dữ liệu lịch sử Chốt 1...</p>';
        }
        const accuracyRate = totalChot > 0 ? (correctChot / totalChot * 100).toFixed(1) : '0.0';
        chotAccuracyStatsSpan.textContent = `Đúng: ${correctChot}/${totalChot} (${accuracyRate}%)`;
    }
    
    // --- PERFORMANCE UPDATE LOGIC ---
    
    function updateChotLengthPerformance(session, tier1Prediction, actualResult) {
        if (!session || !tier1Prediction) return;
        
        const allSessions = Object.values(globalState.sessions); // Lấy state mới nhất
        const actualWL = (tier1Prediction === actualResult) ? 'W' : 'L';
        const allSequences = getChotAnalysisData(allSessions);
        
        if (!session.sys1.chotLengthPerformance) session.sys1.chotLengthPerformance = CHOT_SOURCES.reduce((acc, key) => { acc[key] = {}; return acc; }, {});
        if (!session.sys1.chotOptimalLengths) session.sys1.chotOptimalLengths = CHOT_SOURCES.reduce((acc, key) => { acc[key] = null; return acc; }, {});
        
        const newChotOptimalLengths = { ...session.sys1.chotOptimalLengths };
        
        for (const sourceKey of CHOT_SOURCES) {
            const perfData = session.sys1.chotLengthPerformance[sourceKey];
            const historicalSequences = { ...allSequences[sourceKey] };
            if(historicalSequences) delete historicalSequences[session.name];
            
            const fullCurrentSequence = allSequences[sourceKey]?.[session.name] || "";
            const prevSequence = fullCurrentSequence.slice(0, -1); // Chuỗi W/L *trước* ván này
            const candidates = [];

            for (let len = 3; len <= 20; len++) {
                if (prevSequence.length < len) continue;
                const pattern = prevSequence.slice(-len);
                const stats = findNextOutcomeInHistory(pattern, historicalSequences);
                
                if (stats.total > 0 && stats.W !== stats.L) {
                    const predictedWL = (stats.W > stats.L) ? 'W' : 'L';
                    if (!perfData[len]) perfData[len] = { wins: 0, total: 0 };
                    perfData[len].total++;
                    if (predictedWL === actualWL) perfData[len].wins++;
                }
                if (perfData[len] && perfData[len].total > 0) {
                    candidates.push({
                        length: len,
                        rate: perfData[len].wins / perfData[len].total,
                        total: perfData[len].total
                    });
                }
            }
            
            if (candidates.length > 0) {
                candidates.sort((a, b) => b.rate !== a.rate ? b.rate - a.rate : b.total - a.total);
                newChotOptimalLengths[sourceKey] = candidates[0].length;
            } else {
                newChotOptimalLengths[sourceKey] = null;
            }
        }
        session.sys1.chotOptimalLengths = newChotOptimalLengths;
    }

    function updateLengthPerformanceAndFindOptimal(history, allSessions, newResult, session) {
        if (!session.sys1.lengthPerformance) session.sys1.lengthPerformance = {};
        const candidates = [];
        
        // Loop từ 10 (theo logic HT 1)
        for (let len = 10; len <= 20; len++) {
            if (history.length < len) continue;
            const pattern = history.slice(-len);
            const { prediction } = matcher.getPredictionForPattern(pattern, allSessions);
            if (prediction) {
                if (!session.sys1.lengthPerformance[len]) session.sys1.lengthPerformance[len] = { wins: 0, total: 0 };
                const stats = session.sys1.lengthPerformance[len];
                stats.total++;
                if (prediction === newResult) stats.wins++;
                if (stats.total > 0) {
                    candidates.push({ length: len, rate: stats.wins / stats.total, total: stats.total });
                }
            }
        }

        if (candidates.length === 0) return session.sys1.optimalLength;
        candidates.sort((a, b) => b.rate !== a.rate ? b.rate - a.rate : b.total - a.total);
        return candidates[0].length;
    }

    // --- CÁC HÀM CÔNG KHAI (Public API) ---
    // Được gọi bởi `shared.js`
    return {
        
        /**
         * Trả về trạng thái khởi tạo cho hệ thống này.
         */
        getInitialState: () => ({
            predictions: [],
            verdictPredictions: [],
            chotPredictions: [],
            lengthPerformance: {},
            optimalLength: null,
            chotLengthPerformance: CHOT_SOURCES.reduce((acc, key) => { acc[key] = {}; return acc; }, {}),
            chotOptimalLengths: CHOT_SOURCES.reduce((acc, key) => { acc[key] = null; return acc; }, {})
        }),

        /**
         * Reset state tính toán tạm thời.
         */
        resetTempState: () => {
            tempState = {
                currentPrediction: null,
                originalSystemPrediction: null,
                currentFinalPrediction: null,
                currentChotPredictionForLog: null,
            };
        },

        /**
         * Bước 1 (Điều phối): Tính toán tất cả dự đoán cho ván hiện tại.
         */
        runAllCalculations: (session, allSessions) => {
            // 1. Tính Phán Quyết HT (cập nhật tempState.currentPrediction, ...)
            updateAnalysisUI(session, allSessions);
            
            // 2. Tính Chốt (cập nhật tempState.currentChotPredictionForLog)
            // (Hàm này đọc từ tempState mà updateAnalysisUI vừa set)
            updateChotAnalysisUI(session, allSessions);
        },

        /**
         * Bước 2 (Điều phối): Ghi log kết quả.
         */
        commitResult: (session, result, allSessions) => {
            const tier1Prediction = tempState.originalSystemPrediction;

            // Ghi log Prediction HT1
            if (tempState.currentPrediction && tempState.currentPrediction.prediction) {
                session.sys1.predictions.push({ 
                    predicted: tempState.currentPrediction.prediction, 
                    actual: result, 
                    confidence: tempState.currentPrediction.confidence 
                });
            }
            // Ghi log Verdict
            if (tempState.currentFinalPrediction && tempState.currentFinalPrediction.prediction) {
                session.sys1.verdictPredictions.push({
                    verdict: tempState.currentFinalPrediction.verdict,
                    predicted: tempState.currentFinalPrediction.prediction,
                    actual: result
                });
            }
            // Ghi log Chốt
            const chotRec = tempState.currentChotPredictionForLog;
            if (chotRec && chotRec.prediction) {
                session.sys1.chotPredictions.push({
                    predicted: chotRec.prediction,
                    actual: result,
                    source: chotRec.source,
                    type: chotRec.type,
                    reason: chotRec.reason
                });
            }
            
            // Cập nhật Performance
            updateChotLengthPerformance(session, tier1Prediction, result);
            const newOptimalLength = updateLengthPerformanceAndFindOptimal(
                session.history, // history chung (0 -> N-1)
                allSessions, 
                result, 
                session
            );
            session.sys1.optimalLength = newOptimalLength;
            
            // Reset state tạm thời
            System1.resetTempState();
        },

        /**
         * (Điều phối): Hoàn tác ván cuối cùng.
         */
        undoLast: (session, allSessions, lastResult) => {
            const historyForUndo = session.history.slice(0, -1); // Lịch sử trước khi xóa
            
            // --- Hoàn tác Chốt Performance ---
            const tier1PredictionToUndo = session.sys1.predictions.length > 0 ?
                session.sys1.predictions[session.sys1.predictions.length - 1].predicted : null;
                
            if (tier1PredictionToUndo) {
                const actualWLHt1 = (tier1PredictionToUndo === lastResult) ? 'W' : 'L';
                const allSequencesChot = getChotAnalysisData(allSessions);
                const newChotOptimalLengths = { ...session.sys1.chotOptimalLengths };

                for (const sourceKey of CHOT_SOURCES) {
                    const perfDataChot = session.sys1.chotLengthPerformance[sourceKey];
                    const historicalSequencesChot = { ...allSequencesChot[sourceKey] };
                    if (historicalSequencesChot) delete historicalSequencesChot[session.name];
                    
                    const prevSequenceChot = allSequencesChot[sourceKey]?.[session.name] || "";
                    const candidatesChot = [];
                    
                    for (let len = 3; len <= 20; len++) {
                        if (prevSequenceChot.length < len) continue;
                        const pattern = prevSequenceChot.slice(-len);
                        const stats = findNextOutcomeInHistory(pattern, historicalSequencesChot);
                        
                        if (stats.total > 0 && stats.W !== stats.L) {
                            const predictedWL = (stats.W > stats.L) ? 'W' : 'L';
                            if (perfDataChot[len] && perfDataChot[len].total > 0) {
                                perfDataChot[len].total--;
                                if (predictedWL === actualWLHt1 && perfDataChot[len].wins > 0) {
                                    perfDataChot[len].wins--;
                                }
                            }
                        }
                        if (perfDataChot[len] && perfDataChot[len].total > 0) {
                            candidatesChot.push({ length: len, rate: perfDataChot[len].wins / perfDataChot[len].total, total: perfDataChot[len].total });
                        }
                    }
                    if (candidatesChot.length > 0) {
                        candidatesChot.sort((a, b) => b.rate !== a.rate ? b.rate - a.rate : b.total - a.total);
                        newChotOptimalLengths[sourceKey] = candidatesChot[0].length;
                    } else {
                        newChotOptimalLengths[sourceKey] = null;
                    }
                }
                session.sys1.chotOptimalLengths = newChotOptimalLengths;
            }
            
            // --- Hoàn tác HT1 Performance ---
            if (session.sys1.lengthPerformance) {
                for (let len = 10; len <= 20; len++) {
                    if (historyForUndo.length < len) continue;
                    const pattern = historyForUndo.slice(-len);
                    // Tạo context tạm thời
                    const tempAllSessions = allSessions.map(s => 
                        s.name === session.name ? { ...s, history: [...historyForUndo] } : s
                    );
                    const { prediction } = matcher.getPredictionForPattern(pattern, tempAllSessions);
                    
                    if (prediction) {
                        const stats = session.sys1.lengthPerformance[len];
                        if (stats && stats.total > 0) {
                            stats.total--;
                            if (prediction === lastResult && stats.wins > 0) {
                                stats.wins--;
                            }
                        }
                    }
                }
            }
            // Tính lại optimalLength HT1
            const candidatesHt1 = [];
            if (session.sys1.lengthPerformance) {
                for (const len in session.sys1.lengthPerformance) {
                    const stats = session.sys1.lengthPerformance[len];
                    if (stats.total > 0) {
                        candidatesHt1.push({ length: parseInt(len, 10), rate: stats.wins / stats.total, total: stats.total });
                    }
                }
            }
            if (candidatesHt1.length > 0) {
                candidatesHt1.sort((a, b) => b.rate !== a.rate ? b.rate - a.rate : b.total - a.total);
                session.sys1.optimalLength = candidatesHt1[0].length;
            } else {
                session.sys1.optimalLength = null;
            }

            // Pop predictions
            if (session.sys1.predictions.length > 0) session.sys1.predictions.pop();
            if (session.sys1.verdictPredictions.length > 0) session.sys1.verdictPredictions.pop();
            if (session.sys1.chotPredictions.length > 0) session.sys1.chotPredictions.pop();
        },

        /**
         * (Điều phối): Cập nhật toàn bộ UI cho hệ thống này.
         */
        updateAllUI: (session, allSessions) => {
            // 1. Tính toán Phán Quyết HT (cập nhật tempState)
            updateAnalysisUI(session, allSessions);
            // 2. Tính toán Chốt (đọc tempState và cập nhật tempState)
            updateChotAnalysisUI(session, allSessions);
            // 3. Cập nhật các bảng thống kê
            updateAccuracyUI(session);
            updateGlobalAccuracyUI(allSessions);
            // 4. (Đã xóa) updateConfidenceStatsUI và updateVerdictStatsUI
        },
        
        /**
         * (Điều phối): Xóa lịch sử cho hệ thống này.
         */
        clearHistory: (session) => {
            session.sys1 = System1.getInitialState();
        }
    };

})(); // Đóng IIFE
