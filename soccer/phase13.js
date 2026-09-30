/* STUDY FORGE FC - PHASE 13
 * Prospects, tournament splits, national ranking, and pro scouting.
 * Kept outside index.html so future phases can evolve without editing the giant core file.
 */
(function(global){
  'use strict';

  const COMPETITION_KEYS=['league','interhigh','championship','minor','promotion'];
  const COMPETITION_LABELS={league:'LEAGUE',interhigh:'INTERHIGH',championship:'CHAMPIONSHIP',minor:'CUP',promotion:'PROMOTION'};

  function create(api){
    const state=()=>api.getSoccerState();
    const runtime=()=>api.getMatchRuntime();

    function emptyCompetitionStats(){return {matches:0,minutes:0,goals:0,assists:0,motm:0,cleanSheets:0};}

    function competitionKey(event){
      const type=event?.type||runtime()?.eventType||'minor';
      return COMPETITION_KEYS.includes(type)?type:'minor';
    }

    function ensureCompetitionStats(p){
      p.competitionStats=(p.competitionStats&&typeof p.competitionStats==='object')?p.competitionStats:{};
      COMPETITION_KEYS.forEach(k=>{
        p.competitionStats[k]={...emptyCompetitionStats(),...(p.competitionStats[k]||{})};
      });
      return p.competitionStats;
    }

    function prospectScore(p){
      ensureCompetitionStats(p);
      const national=(p.competitionStats.interhigh.goals||0)*4
        +(p.competitionStats.championship.goals||0)*5
        +(p.competitionStats.interhigh.assists||0)*2.5
        +(p.competitionStats.championship.assists||0)*3
        +(p.competitionStats.championship.motm||0)*4;
      return (Number(p.potential)||70)*.42
        +(Number(p.ovr)||50)*.28
        +(Number(p.talent)||1)*12
        +Math.min(14,api.playerSeasonScore(p)/8)
        +Math.min(12,national);
    }

    function prospectTag(p){
      const score=prospectScore(p),pot=Number(p.potential)||0,talent=Number(p.talent)||1;
      if((pot>=94&&talent>=1.18)||score>=81)return {label:'怪物候補',className:'monster'};
      if(pot>=90||score>=75)return {label:'世代スター',className:'star'};
      if(score>=68||((p.competitionStats?.championship?.goals||0)+(p.competitionStats?.interhigh?.goals||0)>=3))return {label:'全国注目',className:'national'};
      return null;
    }

    function proScoutInterest(p){
      ensureCompetitionStats(p);
      const s=state(),nat=p.competitionStats.interhigh.goals*4
        +p.competitionStats.championship.goals*5
        +p.competitionStats.interhigh.assists*2
        +p.competitionStats.championship.assists*3
        +(p.competitionStats.interhigh.motm+p.competitionStats.championship.motm)*4;
      const gradeBoost=Number(p.grade)>=3?7:Number(p.grade)===2?2:0;
      const raw=(Number(p.ovr)||50)*.54
        +(Number(p.potential)||70)*.24
        +(Number(p.talent)||1)*8
        +Math.min(12,(p.seasonGoals||0)*1.7+(p.seasonAssists||0)*1.1)
        +Math.min(14,nat)
        +Math.min(6,(s.reputation||0)/110)
        +api.currentLeagueTier()*1.2
        +gradeBoost-35;
      return api.clamp(Math.round(raw),0,100);
    }

    function proScoutTier(p){
      const interest=proScoutInterest(p);
      if(interest>=88)return {label:'海外・J1注目',level:'S'};
      if(interest>=76)return {label:'J1注目',level:'A'};
      if(interest>=64)return {label:'J2/J3注目',level:'B'};
      if(interest>=50)return {label:'強豪大学注目',level:'C'};
      if(interest>=35)return {label:'大学スカウト',level:'D'};
      return {label:'経過観察',level:'E'};
    }

    function scoutWatchers(p){
      const interest=proScoutInterest(p);
      if(interest<35)return [];
      const s=state(),seed=api.hash(p.id+':watch:'+s.year),pool=[],dest=api.careerDestinations;
      if(interest>=86)pool.push(...dest.overseas.slice(0,2));
      if(interest>=72)pool.push(...dest.j1);
      else if(interest>=58)pool.push(...dest.j2);
      else if(interest>=46)pool.push(...dest.j3);
      else pool.push(...dest.topUniversity);
      const out=[];
      for(let i=0;i<Math.min(3,1+Math.floor(interest/30));i++){
        const name=pool[(seed+i*7)%pool.length];
        if(name&&!out.includes(name))out.push(name);
      }
      return out;
    }

    function watcherDestinationForType(p,type){
      const watchers=scoutWatchers(p),pool=api.careerDestinations[type]||[];
      return watchers.find(name=>pool.includes(name))||null;
    }

    function userNationalSchool(){
      const s=state();
      const power=api.clamp(Math.round(api.teamOvr()+Math.min(8,s.reputation/120)+Math.min(5,api.facilityTotalLevel()/9)),35,99);
      return {
        id:'user',name:s.schoolName,region:api.currentLeagueRegion(),tier:api.currentLeagueTier(),
        strength:power,prestige:api.clamp(Math.round(40+s.reputation/12),35,99),
        trend:0,lastChange:0,user:true
      };
    }

    function nationalSchoolRanking(){
      const ai=api.worldRanking(),user=userNationalSchool(),all=[...ai,user];
      return all.sort((a,b)=>((b.strength+b.prestige*.06)-(a.strength+a.prestige*.06))||b.prestige-a.prestige);
    }

    function competitionLeaders(key){
      const players=state().players.map(p=>{
        const s=ensureCompetitionStats(p)[key];
        return {p,s,score:s.goals*6+s.assists*4+s.motm*5+s.matches*.4};
      }).filter(x=>x.s.matches>0)
        .sort((a,b)=>b.score-a.score||b.s.goals-a.s.goals);
      return players;
    }

    function scoutBreakthroughs(){
      const rt=runtime();
      if(!rt?.preScoutInterest)return [];
      const thresholds=[50,64,76,88],out=[];
      state().players.forEach(p=>{
        const before=Number(rt.preScoutInterest[p.id])||0,after=proScoutInterest(p);
        const cross=thresholds.filter(t=>before<t&&after>=t).pop();
        if(cross)out.push({p,before,after,tier:proScoutTier(p)});
      });
      return out.sort((a,b)=>b.after-a.after);
    }

    function render(){
      const statsEl=api.dom('seasonCompetitionStats'),watchEl=api.dom('seasonProScoutWatch');
      if(!statsEl||!watchEl)return;
      const keys=['league','interhigh','championship','minor'];
      statsEl.innerHTML=keys.map(key=>{
        const leaders=competitionLeaders(key).slice(0,3);
        return '<div class="phase13-comp-card"><span>'+COMPETITION_LABELS[key]+'</span>'
          +(leaders.length
            ?leaders.map(x=>'<div class="phase13-comp-row"><b>'+api.escapeHtml(x.p.name)+'</b><small>'+x.s.goals+'G '+x.s.assists+'A • MOM '+x.s.motm+'</small></div>').join('')
            :'<div class="phase13-comp-row"><b>記録なし</b><small>—</small></div>')
          +'</div>';
      }).join('');

      const watch=state().players.slice()
        .sort((a,b)=>proScoutInterest(b)-proScoutInterest(a))
        .filter(p=>p.grade>=3||prospectTag(p))
        .slice(0,6);
      watchEl.innerHTML=watch.length?watch.map(p=>{
        const interest=proScoutInterest(p),tier=proScoutTier(p),tag=prospectTag(p),clubs=scoutWatchers(p);
        return '<div class="phase13-scout-row"><div class="phase13-scout-head"><b>'
          +api.escapeHtml(p.name)+' • '+p.primaryPos+' • '+p.grade+'年</b><strong>'+interest+'%</strong></div><small>'
          +tier.level+' • '+tier.label+(clubs.length?' • '+clubs.map(api.escapeHtml).join(' / '):'')
          +'</small><div class="phase13-scout-bar"><i style="width:'+interest+'%"></i></div>'
          +(tag?'<div class="phase13-badges"><span class="phase13-badge '+tag.className+'">'+tag.label+'</span></div>':'')
          +'</div>';
      }).join(''):'<div class="phase13-scout-row"><b>注目選手なし</b><small>大会で活躍するとスカウト注目度が上がります。</small></div>';
    }

    return {
      competitionKeys:COMPETITION_KEYS,
      competitionLabels:COMPETITION_LABELS,
      emptyCompetitionStats,
      competitionKey,
      ensureCompetitionStats,
      prospectScore,
      prospectTag,
      proScoutInterest,
      proScoutTier,
      scoutWatchers,
      watcherDestinationForType,
      userNationalSchool,
      nationalSchoolRanking,
      competitionLeaders,
      scoutBreakthroughs,
      render
    };
  }

  global.StudyForgePhase13={create};
})(window);
