import json
funds={d["code"]:d for d in json.load(open("data/fonds_ia.json"))}
def nom(c): return funds[c]["nom"]
def cat(c): return funds[c].get("categorie_produit")

CONTEXTE=("Au moment de ce rééquilibrage (juillet 2026), le taux directeur de la Banque du Canada "
"est stable à 2,25 %, l'inflation de base tourne autour de 2 % (l'inflation globale, à ~3,2 %, "
"est surtout tirée par le pétrole) et la croissance économique demeure modérée. Les tensions "
"géopolitiques au Moyen-Orient et l'incertitude commerciale entretiennent la volatilité, tandis "
"que les rendements obligataires sont légèrement plus élevés et que les marchés boursiers ont "
"rebondi. Ce portefeuille privilégie donc des obligations de sociétés et de courte durée (moins "
"sensibles aux taux), une bonne diversification mondiale et une exposition aux infrastructures "
"comme protection contre l'inflation.")

P=[
 {"profil":"prudent","cible":{"revenu":75,"actions":25},
  "titre":"Portefeuille Prudent",
  "resume":"Sécurité du capital et revenu régulier, avec une petite part d'actions de qualité pour un léger potentiel de croissance.",
  "fonds":[
    ("070",10,"Coussin de liquidités sécuritaire; profite du taux monétaire actuel (~2,4 %) sans risque de fluctuation."),
    ("170",20,"Obligations de courte durée, peu sensibles aux mouvements de taux — approprié dans le contexte de taux encore élevés."),
    ("762",25,"Obligations de sociétés de qualité : rendement supérieur aux obligations gouvernementales, durée plus courte."),
    ("605",20,"Diversification obligataire mondiale et multisectorielle pour réduire la dépendance au marché canadien."),
    ("515",15,"Actions canadiennes de dividendes en croissance : revenu et stabilité, volatilité plus faible que le marché."),
    ("876",10,"Cœur d'actions mondiales indiciel, à faible coût, pour une diversification géographique large."),
  ]},
 {"profil":"modéré","cible":{"revenu":60,"actions":40},
  "titre":"Portefeuille Modéré",
  "resume":"Croissance modérée du capital avec une base obligataire dominante et des revenus relativement stables.",
  "fonds":[
    ("170",15,"Obligations courtes, tampon défensif contre la volatilité des taux."),
    ("762",20,"Obligations de sociétés de qualité, moteur de revenu principal."),
    ("605",15,"Obligations mondiales multisectorielles pour diversifier les sources de revenu."),
    ("893",10,"Revenu fixe mondial (PIMCO) : gestion active flexible dans un contexte de taux incertain."),
    ("515",12,"Actions canadiennes de dividendes : revenu et participation à la croissance avec moins de volatilité."),
    ("180",13,"Indiciel américain, cœur d'actions du plus grand marché mondial, à faible coût."),
    ("876",15,"Actions mondiales indicielles pour une exposition diversifiée hors Canada."),
  ]},
 {"profil":"équilibré","cible":{"revenu":55,"actions":45},
  "titre":"Portefeuille Équilibré",
  "resume":"Équilibre entre revenu et croissance, diversifié mondialement, pour une appréciation à moyen et long terme.",
  "fonds":[
    ("762",20,"Obligations de sociétés de qualité, base de revenu stable."),
    ("605",20,"Obligations mondiales multisectorielles, diversification et gestion active de la durée."),
    ("893",15,"Revenu fixe mondial (PIMCO), flexibilité face aux taux."),
    ("010",15,"Actions nord-américaines de grandes sociétés : cœur canadien et américain."),
    ("180",12,"Indiciel américain, exposition au moteur de croissance mondial."),
    ("300",10,"Indiciel international (hors Amérique du Nord) pour diversifier les régions."),
    ("085",8,"Infrastructures mondiales : actifs réels générant des revenus, protection contre l'inflation."),
  ]},
 {"profil":"croissance","cible":{"revenu":30,"actions":70},
  "titre":"Portefeuille Croissance",
  "resume":"Croissance supérieure à la moyenne, à dominante actions mondiales diversifiées, avec une base obligataire réduite.",
  "fonds":[
    ("762",15,"Obligations de sociétés de qualité : stabilité et amortisseur de volatilité."),
    ("605",15,"Obligations mondiales multisectorielles pour diversifier le volet défensif."),
    ("010",15,"Actions nord-américaines, cœur du portefeuille d'actions."),
    ("180",15,"Indiciel américain, exposition au principal marché de croissance."),
    ("707",15,"Actions mondiales gérées activement pour capter les occasions mondiales."),
    ("300",12,"Indiciel international pour élargir la diversification géographique."),
    ("085",8,"Infrastructures mondiales : revenus et protection contre l'inflation."),
    ("921",5,"Actions mondiales concentrées (Fidelity) : convictions fortes, potentiel de surperformance."),
  ]},
 {"profil":"audacieux","cible":{"revenu":15,"actions":85},
  "titre":"Portefeuille Audacieux",
  "resume":"Croissance maximale du capital, presque entièrement en actions mondiales diversifiées, pour un horizon long et une forte tolérance au risque.",
  "fonds":[
    ("605",15,"Unique volet défensif : obligations mondiales pour amortir légèrement la volatilité."),
    ("180",20,"Indiciel américain, plus forte pondération, moteur principal de croissance."),
    ("707",18,"Actions mondiales gérées activement, cœur diversifié du portefeuille."),
    ("876",15,"Actions mondiales indicielles tous pays, diversification à faible coût."),
    ("300",12,"Indiciel international pour l'exposition hors Amérique du Nord."),
    ("921",10,"Actions mondiales concentrées (Fidelity) : convictions fortes."),
    ("085",5,"Infrastructures mondiales : actifs réels, protection contre l'inflation."),
    ("084",5,"Marchés émergents : potentiel de croissance supplémentaire à long terme."),
  ]},
]

out=[]
for p in P:
    tot=sum(w for _,w,_ in p["fonds"])
    assert tot==100, (p["profil"],tot)
    lignes=[{"code":c,"nom":nom(c),"categorie":cat(c),"poids":w,"role":r} for c,w,r in p["fonds"]]
    out.append({
      "profil":p["profil"],"titre":p["titre"],"resume":p["resume"],
      "cible_revenu":p["cible"]["revenu"],"cible_actions":p["cible"]["actions"],
      "contexte_marche":CONTEXTE,
      "date_rebalancement":"2026-07-14",
      "fonds":lignes
    })
json.dump(out,open("data/portefeuilles_modeles.json","w"),ensure_ascii=False,indent=2)
print("OK — 5 portefeuilles écrits dans data/portefeuilles_modeles.json")
for p in out:
    print(f"\n{p['titre']} (R{p['cible_revenu']}/A{p['cible_actions']}) — {len(p['fonds'])} fonds")
    for l in p['fonds']:
        print(f"   {l['poids']:>3}%  {l['code']}  {l['nom'][:40]}")
