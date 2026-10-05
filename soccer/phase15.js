/* STUDY FORGE FC - PHASE 15
 * Study dopamine loop: instant answer hits, combo targets, FEVER and real soccer bonus events.
 */
(function(global){
  'use strict';

  const MILESTONES=[3,5,10,20];
  const ATTRS=['PAC','SHO','PAS','DRI','DEF','PHY'];

  function create(api){
    const root=()=>api.getState();
    const soccer=()=>root().soccer;
    const study=()=>root().study;
    const clamp=(v,a,b)=>api.clamp(Number(v)||0,a,b);

    function ensure(){
      const st=study();
      st.phase15=(st.phase15&&typeof st.phase15==='object')?st.phase15:{};
      const p=st.phase15;
      p.feverRemaining=Math.max(0,Number(p.feverRemaining)||0);
      p.jackpots=Math.max(0,Number(p.jackpots)||0);
      p.rareEvents=Math.max(0,Number(p.rareEvents)||0);
      p.totalBonusTP=Math.max(0,Number(p.totalBonusTP)||0);
      p.totalBonusSP=Math.max(0,Number(p.totalBonusSP)||0);
      p.lastEvent=p.lastEvent||null;
      return p;
    }

    function nextTarget(combo=Number(study().combo)||0){
      const hit=MILESTONES.find(x=>x>combo);
      if(hit)return hit;
      return Math.ceil((combo+1)/5)*5;
    }
    function targetStart(target){
      if(target<=3)return 0;
      if(target<=5)return 3;
      if(target<=10)return 5;
      if(target<=20)return 10;
      return target-5;
    }
    function targetProgress(combo=Number(study().combo)||0){
      const target=nextTarget(combo),start=targetStart(target);
      return {target,start,left:Math.max(1,target-combo),pct:clamp((combo-start)/(target-start)*100,0,100)};
    }

    function hud(){
      const screen=api.dom('screen-study')||document.querySelector('[data-screen="study"]');
      const panel=screen?.querySelector('.question-panel');if(!panel)return null;
      let el=api.dom('phase15StudyHud');
      if(!el){
        el=document.createElement('div');el.id='phase15StudyHud';el.className='phase15-study-hud';
        el.innerHTML='<div class="phase15-hit-card"><span>STREAK</span><b id="phase15Combo">0 COMBO</b><small id="phase15ComboTier">BUILDING</small></div><div class="phase15-hit-card target"><span>NEXT HIT</span><b id="phase15NextHit">あと3問</b><div class="phase15-target-bar"><i id="phase15TargetBar"></i></div></div><div class="phase15-hit-card fever"><span>FEVER</span><b id="phase15Fever">LOCKED</b><small id="phase15FeverSub">10 COMBOで突入</small></div>';
        panel.insertBefore(el,panel.firstChild);
      }
      return el;
    }
    function overlay(){
      const screen=api.dom('screen-study')||document.querySelector('[data-screen="study"]');if(!screen)return null;
      let el=api.dom('phase15AnswerBurst');
      if(!el){
        el=document.createElement('div');el.id='phase15AnswerBurst';el.className='phase15-answer-burst';
        el.innerHTML='<div class="phase15-burst-core"><span id="phase15BurstKicker">HIT</span><b id="phase15BurstTitle">CORRECT!</b><strong id="phase15BurstReward">+12 TP</strong><small id="phase15BurstSub">TEAM GROWTH</small></div>';
        screen.appendChild(el);
      }
      return el;
    }
    function render(){
      ensure();const el=hud();if(!el)return;
      const combo=Number(study().combo)||0,p=ensure(),t=targetProgress(combo);
      api.dom('phase15Combo').textContent=combo+' COMBO';
      api.dom('phase15ComboTier').textContent=combo>=20?'ULTRA':combo>=10?'FEVER CHAIN':combo>=5?'HOT STREAK':combo>=3?'COMBO':'BUILDING';
      api.dom('phase15NextHit').textContent='あと'+t.left+'問';
      api.dom('phase15TargetBar').style.width=t.pct+'%';
      const active=p.feverRemaining>0;
      api.dom('phase15Fever').textContent=active?'FEVER ×'+p.feverRemaining:'LOCKED';
      api.dom('phase15FeverSub').textContent=active?'正解で追加BONUS':'10 COMBOで突入';
      el.classList.toggle('fever-active',active);
    }

    let burstTimer=null;
    function showBurst({kicker='CORRECT',title='NICE!',reward='',sub='',kind='good',duration=920}={}){
      const el=overlay();if(!el)return;
      clearTimeout(burstTimer);
      el.className='phase15-answer-burst show '+kind;
      api.dom('phase15BurstKicker').textContent=kicker;
      api.dom('phase15BurstTitle').textContent=title;
      api.dom('phase15BurstReward').textContent=reward;
      api.dom('phase15BurstSub').textContent=sub;
      burstTimer=setTimeout(()=>{el.classList.remove('show');},duration);
    }

    function addBonus(tp=0,sp=0){
      const s=soccer(),p=ensure();
      const t=Math.max(0,Math.round(tp)),sc=Math.max(0,Math.round(sp));
      s.trainingPoints=(Number(s.trainingPoints)||0)+t;
      if(s.scouting)s.scouting.points=(Number(s.scouting.points)||0)+sc;
      p.totalBonusTP+=t;p.totalBonusSP+=sc;
      return {tp:t,sp:sc};
    }
    function eligiblePlayers(){
      return (soccer().players||[]).filter(x=>x&&Number(x.grade)>=1&&Number(x.grade)<=3);
    }
    function pickPlayer(){
      const list=eligiblePlayers();if(!list.length)return null;
      const starters=list.filter(p=>(soccer().starterIds||[]).includes(p.id));
      const pool=starters.length&&Math.random()<.7?starters:list;
      return pool[Math.floor(Math.random()*pool.length)]||null;
    }
    function trainingHit(xp=10){
      const p=pickPlayer();if(!p)return null;
      p.developmentXp=Math.max(0,Number(p.developmentXp)||0)+xp;
      return p;
    }
    function potentialBurst(){
      const list=eligiblePlayers().filter(p=>(Number(p.potential)||70)<99);
      if(!list.length)return null;
      const p=list[Math.floor(Math.random()*list.length)];
      p.potential=clamp((Number(p.potential)||70)+1,50,99);
      return p;
    }
    function instantAttributeHit(){
      const p=pickPlayer();if(!p)return null;
      const posMap={GK:['DEF','PHY','PAS'],CB:['DEF','PHY','PAC'],LSB:['PAC','DEF','PAS'],RSB:['PAC','DEF','PAS'],DMF:['DEF','PAS','PHY'],CMF:['PAS','DRI','PHY'],OMF:['PAS','DRI','SHO'],LMF:['PAC','DRI','PAS'],RMF:['PAC','DRI','PAS'],LWG:['PAC','DRI','SHO'],RWG:['PAC','DRI','SHO'],CF:['SHO','PAC','PHY']};
      const pool=posMap[p.primaryPos]||ATTRS,attr=pool[Math.floor(Math.random()*pool.length)];
      p[attr]=clamp((Number(p[attr])||40)+1,25,99);
      if(api.playerOvr)p.ovr=api.playerOvr(p);
      return {p,attr};
    }

    function randomEvent(combo){
      const r=Math.random();
      if(r<.008){
        const p=potentialBurst();if(!p)return null;
        ensure().rareEvents++;return {kind:'legendary',kicker:'!!! ULTRA EVENT !!!',title:'POTENTIAL BURST',reward:p.name+' • POT +1',sub:'才能限界が上昇',tp:0,sp:0};
      }
      if(r<.025){
        const hit=instantAttributeHit();if(!hit)return null;
        ensure().rareEvents++;return {kind:'legendary',kicker:'SUPER TRAINING',title:'ABILITY UP!',reward:hit.p.name+' • '+hit.attr+' +1',sub:'即時能力アップ',tp:4,sp:1};
      }
      if(r<.075){
        const p=trainingHit(24);return {kind:'crit',kicker:'TRAINING HIT',title:'GROWTH BURST!',reward:(p?p.name+' • ':'')+'育成XP +24',sub:'選手が急成長',tp:8,sp:0};
      }
      if(r<.13){
        return {kind:'scout',kicker:'SCOUT SIGNAL',title:'HOT PROSPECT!',reward:'SCOUT PT +4',sub:'次の逸材探索へ',tp:0,sp:4};
      }
      if(r<.21||combo>=5&&r<.28){
        const p=trainingHit(10);return {kind:'good',kicker:'TRAINING HIT',title:'NICE GROWTH',reward:(p?p.name+' • ':'')+'育成XP +10',sub:'正解が選手を強くする',tp:4,sp:0};
      }
      return null;
    }

    function milestoneEvent(combo){
      if(combo===3)return {kind:'good',kicker:'3 COMBO',title:'COMBO START!',reward:'育成PT +3',sub:'STREAK BONUS',tp:3,sp:0};
      if(combo===5)return {kind:'crit',kicker:'5 COMBO',title:'BONUS TRAINING!',reward:'育成PT +7',sub:'TEAM GROWTH UP',tp:7,sp:0,xp:12};
      if(combo===10)return {kind:'fever',kicker:'10 COMBO',title:'FEVER START!!',reward:'育成PT +10 • SP +3',sub:'次の5正解がBONUS',tp:10,sp:3,fever:5};
      if(combo===20)return {kind:'legendary',kicker:'20 COMBO',title:'ULTRA JACKPOT!!',reward:'育成PT +25 • SP +8',sub:'COMBO MASTER',tp:25,sp:8,jackpot:true,attr:true};
      if(combo>20&&combo%5===0)return {kind:'crit',kicker:combo+' COMBO',title:'CHAIN JACKPOT!',reward:'育成PT +10 • SP +2',sub:'STREAK CONTINUES',tp:10,sp:2};
      return null;
    }

    function applyEvent(event){
      if(!event)return null;
      addBonus(event.tp||0,event.sp||0);
      if(event.xp)trainingHit(event.xp);
      if(event.fever)ensure().feverRemaining=event.fever;
      if(event.jackpot)ensure().jackpots++;
      if(event.attr){
        const hit=instantAttributeHit();
        if(hit)event.reward+=' • '+hit.p.name+' '+hit.attr+' +1';
      }
      ensure().lastEvent={title:event.title,reward:event.reward,at:Date.now()};
      return event;
    }

    function onAnswer(correct,q,{wasReview=false}={}){
      const combo=Number(study().combo)||0,p=ensure();
      if(!correct){
        const hadFever=p.feverRemaining>0;p.feverRemaining=0;
        showBurst({kicker:hadFever?'FEVER END':'COMBO BREAK',title:'REVENGE!',reward:'復習リストへ',sub:'次の正解で取り返そう',kind:'bad',duration:780});
        render();api.save?.();return {event:null};
      }

      let feverBonus=null;
      if(p.feverRemaining>0&&combo!==10){
        p.feverRemaining=Math.max(0,p.feverRemaining-1);
        addBonus(3,1);
        feverBonus={kind:'fever',kicker:'FEVER HIT',title:'BONUS!',reward:'育成PT +3 • SP +1',sub:'残り '+p.feverRemaining+' HIT'};
      }

      const milestone=applyEvent(milestoneEvent(combo));
      const random=milestone?null:applyEvent(randomEvent(combo));
      const event=milestone||random||feverBonus;

      if(wasReview){
        addBonus(3,0);
        showBurst({kicker:'WEAKNESS DESTROYED',title:'REVENGE CLEAR!',reward:'育成PT +3 BONUS',sub:'苦手問題を攻略',kind:'legendary',duration:1050});
      }else if(event){
        showBurst(event);
      }else{
        const baseSp=3;
        showBurst({kicker:combo>=5?'STREAK HIT':'CORRECT',title:combo>=5?'NICE COMBO!':'NICE!',reward:'育成PT +12 • SP +'+baseSp,sub:combo>=3?combo+' COMBO':'TEAM GROWTH',kind:combo>=5?'crit':'good',duration:720});
      }

      render();api.save?.();api.renderSoccer?.();
      return {event};
    }

    function onQuestion(){
      render();
      const combo=Number(study().combo)||0,t=targetProgress(combo);
      const p=ensure();
      if(p.feverRemaining>0)return;
      if(t.left===1){
        const el=hud();el?.classList.add('one-away');
        setTimeout(()=>el?.classList.remove('one-away'),700);
      }
    }

    return {ensure,render,onAnswer,onQuestion,nextTarget,targetProgress};
  }

  global.StudyForgePhase15={create};
})(window);
