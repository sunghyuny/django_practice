from scheduler.models import Game

def run():
    Game.objects.get_or_create(id=1, defaults={'name': '명조'})
    Game.objects.get_or_create(id=2, defaults={'name': '니케'})
    print("Games seeded successfully.")
